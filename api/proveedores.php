<?php
/**
 * api/proveedores.php — T2.4 / US-2.4
 *
 * GET    /api/proveedores.php                      → Lista todos los proveedores
 * GET    /api/proveedores.php?id=N                 → Detalle de un proveedor
 * GET    /api/proveedores.php?ordenes=1&proveedor_id=N → Órdenes de un proveedor
 * GET    /api/proveedores.php?ordenes=1            → Todas las órdenes (historial)
 * POST   /api/proveedores.php                      → Crear proveedor
 * PUT    /api/proveedores.php                      → Actualizar proveedor
 * DELETE /api/proveedores.php?id=N                 → Eliminar proveedor
 * POST   /api/proveedores.php?orden=1              → Registrar orden de compra
 * DELETE /api/proveedores.php?orden_id=N           → Eliminar orden de compra
 *
 * Body POST/PUT proveedor (JSON):
 *   { nombre, contacto?, telefono?, email?, direccion?, ruc? }
 *
 * Body POST orden (JSON):
 *   { proveedor_id, insumo_id, fecha, cantidad, precio_unitario, observaciones? }
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

require_once __DIR__ . '/../backend/conexion.php';
require_once __DIR__ . '/../backend/lib/respuesta.php';

$method = $_SERVER['REQUEST_METHOD'];

/* ============================================================
   Helpers
   ============================================================ */
function sanitizeStr(mixed $val, int $max = 255): string {
    return mb_substr(trim((string)($val ?? '')), 0, $max);
}

/* ============================================================
   DELETE
   ============================================================ */
if ($method === 'DELETE') {
    try {
        // Eliminar orden de compra
        if (isset($_GET['orden_id'])) {
            $id = (int) $_GET['orden_id'];
            if ($id <= 0) respuestaError('orden_id inválido.', 422);

            $stmt = $conn->prepare("DELETE FROM ordenes_compra WHERE id = :id");
            $stmt->execute([':id' => $id]);

            if ($stmt->rowCount() === 0) respuestaError('Orden no encontrada.', 404);
            respuestaOk([['mensaje' => 'Orden eliminada correctamente.']]);
        }

        // Eliminar proveedor
        $id = (int) ($_GET['id'] ?? 0);
        if ($id <= 0) respuestaError('id de proveedor inválido.', 422);

        // Verificar órdenes asociadas
        $check = $conn->prepare("SELECT COUNT(*) FROM ordenes_compra WHERE proveedor_id = :id");
        $check->execute([':id' => $id]);
        if ((int)$check->fetchColumn() > 0) {
            respuestaError('No se puede eliminar: el proveedor tiene órdenes de compra registradas.', 409);
        }

        // Desasociar insumos (best-effort: falla si proveedor_id no existe en la tabla)
        try {
            $conn->prepare("UPDATE inv_insumos SET proveedor_id = NULL WHERE proveedor_id = :id")
                 ->execute([':id' => $id]);
        } catch (\PDOException $ex) { /* columna puede no existir */ }

        $stmt = $conn->prepare("DELETE FROM proveedores WHERE id = :id");
        $stmt->execute([':id' => $id]);

        if ($stmt->rowCount() === 0) respuestaError('Proveedor no encontrado.', 404);
        respuestaOk([['mensaje' => 'Proveedor eliminado correctamente.']]);

    } catch (\PDOException $e) {
        respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
    }
    exit;
}

/* ============================================================
   PUT — Actualizar proveedor
   ============================================================ */
if ($method === 'PUT') {
    try {
        $body = json_decode(file_get_contents('php://input'), true);

        $id        = (int) ($body['id'] ?? 0);
        $nombre    = sanitizeStr($body['nombre'] ?? '');
        $contacto  = sanitizeStr($body['contacto'] ?? '');
        $telefono  = sanitizeStr($body['telefono'] ?? '');
        $email     = sanitizeStr($body['email'] ?? '');
        $direccion = sanitizeStr($body['direccion'] ?? '', 500);
        $ruc       = sanitizeStr($body['ruc'] ?? '');
        $insumoId  = (int) ($body['insumo_id'] ?? 0);

        if ($id <= 0)          respuestaError('id es requerido.', 422);
        if ($nombre === '')    respuestaError('nombre es requerido.', 422);
        if ($contacto === '')  respuestaError('contacto es requerido.', 422);
        if ($telefono === '')  respuestaError('telefono es requerido.', 422);
        if ($email === '')     respuestaError('email es requerido.', 422);
        if ($direccion === '') respuestaError('direccion es requerido.', 422);
        if ($ruc === '')       respuestaError('ruc es requerido.', 422);
        if ($insumoId <= 0)    respuestaError('insumo_id es requerido.', 422);

        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respuestaError('El formato del correo electrónico es inválido.', 422);
        }
        if ($telefono !== '' && !preg_match('/^\+?[0-9\s\-()]{7,20}$/', $telefono)) {
            respuestaError('El formato del teléfono es inválido.', 422);
        }
        if ($ruc !== '' && !preg_match('/^[0-9\-]{8,15}$/', $ruc)) {
            respuestaError('El formato del RUC / NIT es inválido.', 422);
        }

        $sql = "
            UPDATE proveedores
            SET nombre    = :nombre,
                contacto  = :contacto,
                telefono  = :telefono,
                email     = :email,
                direccion = :direccion,
                ruc       = :ruc,
                actualizado_en = NOW()
            WHERE id = :id
        ";
        $stmt = $conn->prepare($sql);
        $stmt->execute([
            ':id'        => $id,
            ':nombre'    => $nombre,
            ':contacto'  => $contacto,
            ':telefono'  => $telefono,
            ':email'     => $email,
            ':direccion' => $direccion,
            ':ruc'       => $ruc,
        ]);

        if ($stmt->rowCount() === 0) respuestaError('Proveedor no encontrado o sin cambios.', 404);

        // Asociar insumo principal si se envió
        $insumoAsoc = (int) ($body['insumo_id'] ?? 0);
        if ($insumoAsoc > 0) {
            try {
                $conn->prepare("
                    UPDATE inv_insumos SET proveedor_id = :prov_id WHERE id = :ins_id
                ")->execute([':prov_id' => $id, ':ins_id' => $insumoAsoc]);
            } catch (\PDOException $ex) { /* columna puede no existir aún */ }
        }

        respuestaOk([['id' => $id, 'mensaje' => 'Proveedor actualizado correctamente.']]);

    } catch (\PDOException $e) {
        respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
    }
    exit;
}

/* ============================================================
   POST
   ============================================================ */
if ($method === 'POST') {
    try {
        $body = json_decode(file_get_contents('php://input'), true);

        // — Registrar orden de compra —
        if (isset($_GET['orden'])) {
            $proveedorId    = (int) ($body['proveedor_id'] ?? 0);
            $insumoId       = (int) ($body['insumo_id'] ?? 0);
            $fecha          = sanitizeStr($body['fecha'] ?? date('Y-m-d'));
            $cantidad       = (float) ($body['cantidad'] ?? 0);
            $precioRaw      = $body['precio_unitario'] ?? null;
            $observaciones  = sanitizeStr($body['observaciones'] ?? '', 500);

            if ($proveedorId <= 0)    respuestaError('proveedor_id es requerido.', 422);
            if ($insumoId <= 0)       respuestaError('insumo_id es requerido.', 422);
            if ($cantidad <= 0)       respuestaError('cantidad debe ser mayor a 0.', 422);

            if ($precioRaw === null || trim((string)$precioRaw) === '') {
                respuestaError('precio_unitario es requerido.', 422);
            }
            if (!is_numeric($precioRaw)) {
                respuestaError('precio_unitario debe ser un valor numérico.', 422);
            }
            $precioUnitario = (float)$precioRaw;
            if ($precioUnitario < 0) {
                respuestaError('precio_unitario no puede ser negativo.', 422);
            }

            // Validar fecha (no futura, no anterior a 5 años)
            if ($fecha === '') {
                respuestaError('fecha es requerida.', 422);
            }
            try {
                $fechaObj = new DateTime($fecha);
                $hoyObj = new DateTime('today');
                $hace5Anios = (new DateTime('today'))->modify('-5 years');

                if ($fechaObj > $hoyObj) {
                    respuestaError('La fecha no puede ser futura.', 422);
                }
                if ($fechaObj < $hace5Anios) {
                    respuestaError('La fecha no puede ser anterior a 5 años.', 422);
                }
            } catch (Exception $e) {
                respuestaError('Formato de fecha inválido.', 422);
            }

            $total = $cantidad * $precioUnitario;
            $sql = "
                INSERT INTO ordenes_compra
                    (proveedor_id, insumo_id, fecha, cantidad, precio_unitario, total, observaciones, creado_en)
                VALUES
                    (:proveedor_id, :insumo_id, :fecha, :cantidad, :precio_unitario,
                     :total, :observaciones, NOW())
            ";
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':proveedor_id'    => $proveedorId,
                ':insumo_id'       => $insumoId,
                ':fecha'           => $fecha,
                ':cantidad'        => $cantidad,
                ':precio_unitario' => $precioUnitario,
                ':total'           => $total,
                ':observaciones'   => $observaciones,
            ]);

            $nuevoId = (int) $conn->lastInsertId();

            // Actualizar stock del insumo
            $conn->prepare("
                UPDATE inv_insumos
                SET stock_actual = stock_actual + :cantidad
                WHERE id = :id
            ")->execute([':cantidad' => $cantidad, ':id' => $insumoId]);

            respuestaOk([['id' => $nuevoId, 'mensaje' => 'Orden de compra registrada correctamente.']]);
            exit;
        }

        // — Crear proveedor —
        $nombre    = sanitizeStr($body['nombre'] ?? '');
        $contacto  = sanitizeStr($body['contacto'] ?? '');
        $telefono  = sanitizeStr($body['telefono'] ?? '');
        $email     = sanitizeStr($body['email'] ?? '');
        $direccion = sanitizeStr($body['direccion'] ?? '', 500);
        $ruc       = sanitizeStr($body['ruc'] ?? '');
        $insumoId  = (int) ($body['insumo_id'] ?? 0);

        if ($nombre === '')    respuestaError('nombre es requerido.', 422);
        if ($contacto === '')  respuestaError('contacto es requerido.', 422);
        if ($telefono === '')  respuestaError('telefono es requerido.', 422);
        if ($email === '')     respuestaError('email es requerido.', 422);
        if ($direccion === '') respuestaError('direccion es requerido.', 422);
        if ($ruc === '')       respuestaError('ruc es requerido.', 422);
        if ($insumoId <= 0)    respuestaError('insumo_id es requerido.', 422);

        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respuestaError('El formato del correo electrónico es inválido.', 422);
        }
        if ($telefono !== '' && !preg_match('/^\+?[0-9\s\-()]{7,20}$/', $telefono)) {
            respuestaError('El formato del teléfono es inválido.', 422);
        }
        if ($ruc !== '' && !preg_match('/^[0-9\-]{8,15}$/', $ruc)) {
            respuestaError('El formato del RUC / NIT es inválido.', 422);
        }

        $sql = "
            INSERT INTO proveedores (nombre, contacto, telefono, email, direccion, ruc, creado_en, actualizado_en)
            VALUES (:nombre, :contacto, :telefono, :email, :direccion, :ruc, NOW(), NOW())
        ";
        $stmt = $conn->prepare($sql);
        $stmt->execute([
            ':nombre'    => $nombre,
            ':contacto'  => $contacto,
            ':telefono'  => $telefono,
            ':email'     => $email,
            ':direccion' => $direccion,
            ':ruc'       => $ruc,
        ]);

        $nuevoId = (int) $conn->lastInsertId();

        // Asociar insumo principal si se envió
        $insumoAsoc = (int) ($body['insumo_id'] ?? 0);
        if ($insumoAsoc > 0) {
            try {
                $conn->prepare("
                    UPDATE inv_insumos SET proveedor_id = :prov_id WHERE id = :ins_id
                ")->execute([':prov_id' => $nuevoId, ':ins_id' => $insumoAsoc]);
            } catch (\PDOException $ex) { /* columna puede no existir aún */ }
        }

        respuestaOk([['id' => $nuevoId, 'mensaje' => 'Proveedor creado correctamente.']]);

    } catch (\PDOException $e) {
        respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
    }
    exit;
}

/* ============================================================
   GET
   ============================================================ */
if ($method === 'GET') {
    try {

        // — Historial de órdenes de compra —
        if (isset($_GET['ordenes'])) {
            $proveedorId = isset($_GET['proveedor_id']) ? (int)$_GET['proveedor_id'] : null;
            $limit = min((int)($_GET['limit'] ?? 50), 200);

            $where = $proveedorId ? "WHERE oc.proveedor_id = :proveedor_id" : "";

            $sql = "
                SELECT
                    oc.id,
                    p.nombre        AS proveedor,
                    i.nombre        AS insumo,
                    i.unidad_medida AS unidad,
                    DATE_FORMAT(oc.fecha, '%Y-%m-%d') AS fecha,
                    oc.cantidad,
                    oc.precio_unitario,
                    oc.total,
                    oc.observaciones
                FROM ordenes_compra oc
                INNER JOIN proveedores p ON p.id = oc.proveedor_id
                INNER JOIN inv_insumos  i ON i.id = oc.insumo_id
                {$where}
                ORDER BY oc.creado_en DESC
                LIMIT :limit
            ";

            $stmt = $conn->prepare($sql);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            if ($proveedorId) $stmt->bindValue(':proveedor_id', $proveedorId, PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll();

            $data = array_map(fn($r) => [
                'id'              => (int)  $r['id'],
                'proveedor'       =>        $r['proveedor'],
                'insumo'          =>        $r['insumo'],
                'unidad'          =>        $r['unidad'],
                'fecha'           =>        $r['fecha'],
                'cantidad'        => (float)$r['cantidad'],
                'precio_unitario' => (float)$r['precio_unitario'],
                'total'           => (float)$r['total'],
                'observaciones'   =>        $r['observaciones'],
            ], $rows);

            respuestaOk($data, ['total' => count($data)]);
            exit;
        }

        // — Detalle de un proveedor con sus insumos asociados —
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];
            if ($id <= 0) respuestaError('id inválido.', 422);

            $stmt = $conn->prepare("SELECT * FROM proveedores WHERE id = :id");
            $stmt->execute([':id' => $id]);
            $prov = $stmt->fetch();
            if (!$prov) respuestaError('Proveedor no encontrado.', 404);

            // Insumos asociados (best-effort: falla si proveedor_id no existe aún)
            $prov['insumos'] = [];
            try {
                $si = $conn->prepare("
                    SELECT id, nombre, unidad_medida, stock_actual
                    FROM inv_insumos
                    WHERE proveedor_id = :id
                    ORDER BY nombre
                ");
                $si->execute([':id' => $id]);
                $prov['insumos'] = $si->fetchAll();
            } catch (\PDOException $ex) { /* columna puede no existir */ }

            respuestaOk([$prov]);
            exit;
        }

        // — Lista de todos los proveedores —
        // Intentamos incluir insumos; si proveedor_id no existe en inv_insumos lo ignoramos
        $hasProvCol = false;
        try {
            $conn->query("SELECT proveedor_id FROM inv_insumos LIMIT 1");
            $hasProvCol = true;
        } catch (\PDOException $ex) { /* columna no existe */ }

        $insumosSql = $hasProvCol
            ? "(SELECT GROUP_CONCAT(ii.nombre ORDER BY ii.nombre SEPARATOR '||') FROM inv_insumos ii WHERE ii.proveedor_id = p.id) AS insumos_nombres,
               (SELECT GROUP_CONCAT(ii2.id    ORDER BY ii2.nombre SEPARATOR ',')  FROM inv_insumos ii2 WHERE ii2.proveedor_id = p.id) AS insumos_ids,
               (SELECT COUNT(*) FROM inv_insumos ii3 WHERE ii3.proveedor_id = p.id) AS total_insumos,"
            : "NULL AS insumos_nombres, NULL AS insumos_ids, 0 AS total_insumos,";

        $sql = "
            SELECT
                p.id,
                p.nombre,
                p.contacto,
                p.telefono,
                p.email,
                p.direccion,
                p.ruc,
                DATE_FORMAT(p.creado_en, '%Y-%m-%d') AS creado_en,
                (SELECT COUNT(*) FROM ordenes_compra oc WHERE oc.proveedor_id = p.id) AS total_ordenes,
                (SELECT COALESCE(SUM(oc2.total),0) FROM ordenes_compra oc2 WHERE oc2.proveedor_id = p.id) AS monto_total,
                {$insumosSql}
                1 AS _dummy
            FROM proveedores p
            ORDER BY p.nombre
        ";

        $stmt = $conn->query($sql);
        $rows = $stmt->fetchAll();

        $data = array_map(fn($r) => [
            'id'             => (int)   $r['id'],
            'nombre'         =>         $r['nombre'],
            'contacto'       =>         $r['contacto'],
            'telefono'       =>         $r['telefono'],
            'email'          =>         $r['email'],
            'direccion'      =>         $r['direccion'],
            'ruc'            =>         $r['ruc'],
            'creado_en'      =>         $r['creado_en'],
            'total_ordenes'  => (int)   $r['total_ordenes'],
            'total_insumos'  => (int)   $r['total_insumos'],
            'monto_total'    => (float) $r['monto_total'],
            // Insumos asociados como arrays (separador '||' para nombres, ',' para ids)
            'insumos_nombres'=> $r['insumos_nombres']
                                ? array_map('trim', explode('||', $r['insumos_nombres']))
                                : [],
            'insumos_ids'    => $r['insumos_ids']
                                ? array_map('intval', explode(',', $r['insumos_ids']))
                                : [],
        ], $rows);

        respuestaOk($data, ['total' => count($data)]);

    } catch (\PDOException $e) {
        respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
    }
    exit;
}

respuestaError('Método no permitido.', 405);
