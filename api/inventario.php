<?php
/**
 * api/inventario.php
 *
 * GET   /api/inventario.php                    → lista todos los insumos
 * GET   /api/inventario.php?alerta=stock_minimo → solo los que están en alerta
 * PATCH /api/inventario.php                    → ajusta stock (testing T2.5)
 *   Body: { "insumo_id": 3, "delta": 2.5 }
 *   delta > 0 → suma stock   (simula recepción de mercadería)
 *   delta < 0 → resta stock  (simula consumo manual)
 *
 * Respuesta incluye para cada insumo:
 *   - stock_actual:   cantidad disponible actualmente
 *   - stock_minimo:   umbral configurado de alerta
 *   - alerta_stock:   true si stock_actual <= stock_minimo
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

require_once __DIR__ . '/../backend/conexion.php';
require_once __DIR__ . '/../backend/lib/respuesta.php';

$method = $_SERVER['REQUEST_METHOD'];

// ============================================================================
// PATCH — Ajustar stock de un insumo (herramienta de testing T2.5)
// ============================================================================
if ($method === 'PATCH') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['insumo_id']) || !isset($input['delta'])) {
        respuestaError('Faltan parámetros: insumo_id y delta son obligatorios.', 400);
    }

    $insumoId = (int)   $input['insumo_id'];
    $delta    = (float) $input['delta'];

    if ($delta == 0) {
        respuestaError('El delta no puede ser 0.', 400);
    }

    try {
        $conn->beginTransaction();

        // 1. Leer stock actual con bloqueo
        $stmtLeer = $conn->prepare("
            SELECT id, nombre, stock_actual, stock_minimo, unidad_medida
            FROM   inv_insumos
            WHERE  id = :id
            FOR UPDATE
        ");
        $stmtLeer->execute([':id' => $insumoId]);
        $insumo = $stmtLeer->fetch();

        if (!$insumo) {
            $conn->rollBack();
            respuestaError("Insumo #{$insumoId} no encontrado.", 404);
        }

        $stockAntes = (float) $insumo['stock_actual'];
        $nuevoStock = max(0, round($stockAntes + $delta, 3));

        // 2. Actualizar stock en inv_insumos
        $conn->prepare("
            UPDATE inv_insumos SET stock_actual = :nuevo WHERE id = :id
        ")->execute([':nuevo' => $nuevoStock, ':id' => $insumoId]);

        // 3. Sincronizar el lote correspondiente
        if ($delta > 0) {
            // Sumar al lote más reciente; si no hay lotes, crear uno de prueba
            $stmtLote = $conn->prepare("
                SELECT id FROM inv_lotes_insumo
                WHERE  insumo_id = :id
                ORDER BY fecha_ingreso DESC, id DESC
                LIMIT 1
            ");
            $stmtLote->execute([':id' => $insumoId]);
            $lote = $stmtLote->fetch();

            if ($lote) {
                $conn->prepare("
                    UPDATE inv_lotes_insumo SET cantidad = cantidad + :delta WHERE id = :lid
                ")->execute([':delta' => $delta, ':lid' => $lote['id']]);
            } else {
                $conn->prepare("
                    INSERT INTO inv_lotes_insumo (insumo_id, cantidad, fecha_ingreso, proveedor)
                    VALUES (:iid, :cant, CURDATE(), 'Ajuste manual (test)')
                ")->execute([':iid' => $insumoId, ':cant' => $delta]);
            }
        } else {
            // Restar del lote FIFO con stock disponible
            $stmtLote = $conn->prepare("
                SELECT id, cantidad FROM inv_lotes_insumo
                WHERE  insumo_id = :id AND cantidad > 0
                ORDER BY
                    CASE WHEN fecha_vencimiento IS NULL THEN 1 ELSE 0 END ASC,
                    fecha_vencimiento ASC, id ASC
                LIMIT 1
            ");
            $stmtLote->execute([':id' => $insumoId]);
            $lote = $stmtLote->fetch();

            if ($lote) {
                $restar    = min(abs($delta), (float) $lote['cantidad']);
                $nuevoCant = round((float) $lote['cantidad'] - $restar, 3);
                $conn->prepare("
                    UPDATE inv_lotes_insumo SET cantidad = :nueva WHERE id = :lid
                ")->execute([':nueva' => $nuevoCant, ':lid' => $lote['id']]);
            }
        }

        // 4. Recalcular disponibilidad de platos que usan este insumo
        $platosAfectados = [];

        if ($nuevoStock <= 0) {
            // Insumo agotado → marcar platos que lo usan como no disponibles
            $conn->prepare("
                UPDATE cat_platos p
                JOIN   inv_recetas r ON r.plato_id = p.id
                SET    p.disponible = 0
                WHERE  r.insumo_id = :iid
            ")->execute([':iid' => $insumoId]);

            $stmtP = $conn->prepare("
                SELECT p.id, p.nombre FROM cat_platos p
                JOIN   inv_recetas r ON r.plato_id = p.id
                WHERE  r.insumo_id = :iid
            ");
            $stmtP->execute([':iid' => $insumoId]);
            $platosAfectados = $stmtP->fetchAll();

        } elseif ($stockAntes <= 0 && $nuevoStock > 0) {
            // Insumo recuperado → reactivar platos si TODOS sus insumos tienen stock
            $stmtP = $conn->prepare("
                SELECT DISTINCT p.id, p.nombre FROM cat_platos p
                JOIN   inv_recetas r ON r.plato_id = p.id
                WHERE  r.insumo_id = :iid
            ");
            $stmtP->execute([':iid' => $insumoId]);
            $candidatos = $stmtP->fetchAll();

            foreach ($candidatos as $plato) {
                $stmtCheck = $conn->prepare("
                    SELECT COUNT(*) FROM inv_recetas r
                    JOIN   inv_insumos i ON i.id = r.insumo_id
                    WHERE  r.plato_id = :pid AND i.stock_actual <= 0
                ");
                $stmtCheck->execute([':pid' => $plato['id']]);
                if ((int) $stmtCheck->fetchColumn() === 0) {
                    $conn->prepare("UPDATE cat_platos SET disponible = 1 WHERE id = :pid")
                         ->execute([':pid' => $plato['id']]);
                    $platosAfectados[] = $plato;
                }
            }
        }

        $conn->commit();

        $accion = $delta > 0 ? 'aumentado' : 'reducido';
        respuestaOk(
            [
                'insumo_id'        => $insumoId,
                'nombre'           => $insumo['nombre'],
                'stock_anterior'   => $stockAntes,
                'stock_actual'     => $nuevoStock,
                'delta_aplicado'   => $delta,
                'platos_afectados' => $platosAfectados,
            ],
            ['generado_en' => date('c')],
            "Stock {$accion} en " . abs($delta) . " {$insumo['unidad_medida']}."
        );

    } catch (\PDOException $e) {
        if ($conn->inTransaction()) $conn->rollBack();
        respuestaError('Error de BD: ' . $e->getMessage(), 500);
    }
}

// ============================================================================
// GET — Lista de insumos con estado de stock
// ============================================================================
elseif ($method === 'GET') {
    try {
        $soloEnAlerta = isset($_GET['alerta']) && $_GET['alerta'] === 'stock_minimo';
        $whereSQL     = $soloEnAlerta ? 'WHERE stock_actual <= stock_minimo' : '';

        $sql = "
            SELECT
                id,
                nombre,
                unidad_medida,
                stock_actual,
                stock_minimo,
                costo_unitario,
                creado_en
            FROM inv_insumos
            {$whereSQL}
            ORDER BY nombre ASC
        ";

        $stmt    = $conn->query($sql);
        $insumos = $stmt->fetchAll();

        $insumosConFlag = array_map(function (array $insumo): array {
            $stockActual = (float) $insumo['stock_actual'];
            $stockMinimo = (float) $insumo['stock_minimo'];
            return array_merge($insumo, [
                'stock_actual'   => $stockActual,
                'stock_minimo'   => $stockMinimo,
                'costo_unitario' => $insumo['costo_unitario'] !== null ? (float) $insumo['costo_unitario'] : null,
                'alerta_stock'   => $stockActual <= $stockMinimo,
            ]);
        }, $insumos);

        $meta = [
            'filtros'   => ['alerta' => $soloEnAlerta ? 'stock_minimo' : null],
            'total'     => count($insumosConFlag),
            'en_alerta' => count(array_filter($insumosConFlag, fn($i) => $i['alerta_stock'])),
            'ok'        => count(array_filter($insumosConFlag, fn($i) => !$i['alerta_stock'])),
        ];

        respuestaOk($insumosConFlag, $meta);

    } catch (\PDOException $e) {
        respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
    } catch (\Throwable $e) {
        respuestaError('Error interno: ' . $e->getMessage(), 500);
    }
}

else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
}
