<?php
/**
 * api/mermas.php — T2.3 / US-2.3
 *
 * GET  /api/mermas.php?periodo=semana          → Top 5 insumos con más mermas (semana/mes/anio)
 * GET  /api/mermas.php?top5=1&periodo=semana   → Alias del anterior (retrocompatible)
 * GET  /api/mermas.php?historial=1&limit=10    → Últimas N mermas registradas
 * POST /api/mermas.php                         → Registrar una merma manual
 *
 * Body POST (JSON):
 *   { insumo_id, cantidad, motivo, fecha?, observaciones? }
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

require_once __DIR__ . '/../backend/conexion.php';
require_once __DIR__ . '/../backend/lib/respuesta.php';

$method = $_SERVER['REQUEST_METHOD'];

/* ============================================================
   POST — Registrar merma manual
   ============================================================ */
if ($method === 'POST') {
    try {
        $body = json_decode(file_get_contents('php://input'), true);

        // Validaciones básicas
        $insumoId = isset($body['insumo_id']) ? (int) $body['insumo_id'] : 0;
        $cantidad  = isset($body['cantidad'])  ? (float) $body['cantidad']  : 0;
        $motivo    = isset($body['motivo'])    ? trim($body['motivo'])      : '';
        $fecha     = isset($body['fecha'])     ? trim($body['fecha'])       : date('Y-m-d');
        $obs       = isset($body['observaciones']) ? trim($body['observaciones']) : '';

        if ($insumoId <= 0) {
            respuestaError('insumo_id es requerido.', 422);
        }
        if ($cantidad <= 0) {
            respuestaError('cantidad debe ser mayor a 0.', 422);
        }
        $motivosValidos = ['vencimiento','danio_fisico','error_preparacion','contaminacion','exceso_produccion','otro'];
        if (!in_array($motivo, $motivosValidos, true)) {
            respuestaError('motivo inválido.', 422);
        }

        // Validar contra stock disponible
        $stmtStock = $conn->prepare("SELECT stock_actual, nombre, unidad_medida FROM inv_insumos WHERE id = :id");
        $stmtStock->execute([':id' => $insumoId]);
        $insumoDb = $stmtStock->fetch(PDO::FETCH_ASSOC);

        if (!$insumoDb) {
            respuestaError('El insumo especificado no existe.', 422);
        }

        $stockActual = (float)$insumoDb['stock_actual'];
        if ($cantidad > $stockActual) {
            respuestaError("La cantidad de merma ({$cantidad}) supera el stock disponible ({$stockActual} {$insumoDb['unidad_medida']}).", 422);
        }

        // Insertar en la tabla mermas
        $sql = "
            INSERT INTO mermas (insumo_id, cantidad, motivo, fecha, observaciones, creado_en)
            VALUES (:insumo_id, :cantidad, :motivo, :fecha, :observaciones, NOW())
        ";
        $stmt = $conn->prepare($sql);
        $stmt->execute([
            ':insumo_id'     => $insumoId,
            ':cantidad'      => $cantidad,
            ':motivo'        => $motivo,
            ':fecha'         => $fecha,
            ':observaciones' => $obs,
        ]);

        $nuevoId = (int) $conn->lastInsertId();

        // Descontar del stock del insumo
        $connUpdate = $conn->prepare("
            UPDATE inv_insumos
            SET stock_actual = GREATEST(stock_actual - :cantidad, 0)
            WHERE id = :id
        ");
        $connUpdate->execute([':cantidad' => $cantidad, ':id' => $insumoId]);

        respuestaOk(['id' => $nuevoId, 'mensaje' => 'Merma registrada correctamente.']);

    } catch (\PDOException $e) {
        respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
    } catch (\Throwable $e) {
        respuestaError('Error interno: ' . $e->getMessage(), 500);
    }
    exit;
}

/* ============================================================
   GET — Consultas de mermas
   ============================================================ */
if ($method === 'GET') {
    try {

        // ── Top 5 insumos perdidos ─────────────────────────────────────────
        // Acepta ?periodo=semana (forma corta) o ?top5=1&periodo=semana (legado)
        if (isset($_GET['top5']) || isset($_GET['periodo'])) {
            $periodo = $_GET['periodo'] ?? 'semana';

            $intervalo = match($periodo) {
                'mes'   => 'INTERVAL 30 DAY',
                'anio'  => 'INTERVAL 1 YEAR',
                default => 'INTERVAL 7 DAY',   // semana
            };

            $sql = "
                SELECT
                    i.nombre,
                    i.unidad_medida,
                    SUM(m.cantidad) AS cantidad
                FROM mermas m
                INNER JOIN inv_insumos i ON i.id = m.insumo_id
                WHERE m.fecha >= DATE_SUB(CURDATE(), {$intervalo})
                GROUP BY i.id, i.nombre, i.unidad_medida
                ORDER BY cantidad DESC
                LIMIT 5
            ";

            $stmt = $conn->query($sql);
            $top5 = $stmt->fetchAll();

            $data = array_map(fn($r) => [
                'nombre'   => $r['nombre'],
                'unidad'   => $r['unidad_medida'],
                'cantidad' => (float) $r['cantidad'],
            ], $top5);

            respuestaOk($data, ['periodo' => $periodo, 'total' => count($data)]);
            exit;
        }

        // ── Historial reciente ───────────────────────────────────────────────
        if (isset($_GET['historial'])) {
            $limit = min((int) ($_GET['limit'] ?? 10), 50);

            $sql = "
                SELECT
                    m.id,
                    i.nombre      AS insumo,
                    i.unidad_medida AS unidad,
                    m.cantidad,
                    m.motivo,
                    DATE_FORMAT(m.fecha, '%Y-%m-%d') AS fecha,
                    m.observaciones
                FROM mermas m
                INNER JOIN inv_insumos i ON i.id = m.insumo_id
                ORDER BY m.creado_en DESC
                LIMIT :limit
            ";

            $stmt = $conn->prepare($sql);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll();

            $data = array_map(fn($r) => [
                'id'       => (int) $r['id'],
                'insumo'   => $r['insumo'],
                'unidad'   => $r['unidad'],
                'cantidad' => (float) $r['cantidad'],
                'motivo'   => $r['motivo'],
                'fecha'    => $r['fecha'],
            ], $rows);

            respuestaOk($data, ['total' => count($data)]);
            exit;
        }

        // Sin parámetros reconocidos → error descriptivo
        respuestaError('Usa ?periodo=semana (o ?top5=1&periodo=semana) para el top5, o ?historial=1 para el historial.', 400);

    } catch (\PDOException $e) {
        respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
    } catch (\Throwable $e) {
        respuestaError('Error interno: ' . $e->getMessage(), 500);
    }
    exit;
}

respuestaError('Método no permitido.', 405);
