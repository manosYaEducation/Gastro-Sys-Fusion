<?php
/**
 * api/pedidos.php
 *
 * GET  → Pedidos activos (pendiente o en_preparacion) con sus detalles.
 * POST → Acciones sobre pedidos:
 *
 *   action: "confirmar"
 *     - Crea el pedido en ven_pedidos + ven_detalle_pedido.
 *     - Ejecuta descuento FIFO de stock (T2.5 / US-5.1).
 *     - Si algún insumo llega a 0, marca el plato como disponible = 0.
 *     - Todo en una transacción atómica.
 *
 *   action: "marcar_listo"
 *     - Actualiza estado del pedido a 'servido'.
 *     - Registra notificación (log de email simulado).
 *
 * Body esperado para "confirmar":
 * {
 *   "action": "confirmar",
 *   "usuario_id": 1,          ← null si cliente no registrado
 *   "total_pedido": 29900,
 *   "clima_al_pedir": "frio", ← opcional
 *   "temp_al_pedir": 10.5,    ← opcional
 *   "items": [
 *     { "plato_id": 3, "cantidad": 2, "precio_unit": 9900 },
 *     { "plato_id": 7, "cantidad": 1, "precio_unit": 10100 }
 *   ]
 * }
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
require_once __DIR__ . '/../backend/lib/descuento_stock.php';

$method = $_SERVER['REQUEST_METHOD'];

// ============================================================================
// GET — Pedidos activos con sus detalles
// ============================================================================
if ($method === 'GET') {
    try {
        $sql = "
            SELECT id, usuario_id, total_pedido, estado, creado_en
            FROM   ven_pedidos
            WHERE  estado IN ('pendiente', 'en_preparacion')
            ORDER BY creado_en ASC
        ";
        $stmt    = $conn->query($sql);
        $pedidos = $stmt->fetchAll();

        foreach ($pedidos as &$pedido) {
            $stmtDetalle = $conn->prepare("
                SELECT d.id, d.plato_id, d.cantidad, p.nombre,
                       d.precio_unit, d.subtotal
                FROM   ven_detalle_pedido d
                JOIN   cat_platos p ON p.id = d.plato_id
                WHERE  d.pedido_id = :pedido_id
            ");
            $stmtDetalle->execute([':pedido_id' => $pedido['id']]);
            $pedido['platos'] = $stmtDetalle->fetchAll();
        }
        unset($pedido);

        echo json_encode([
            'success' => true,
            'data'    => $pedidos,
            'meta'    => ['total' => count($pedidos), 'generado_en' => date('c')],
            'error'   => null,
        ]);

    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error de BD', 'message' => $e->getMessage()]);
    }
}

// ============================================================================
// POST — Acciones (confirmar | marcar_listo)
// ============================================================================
elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['action'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Falta el parámetro "action"']);
        exit;
    }

    $action = $input['action'];

    // ── ACCIÓN: confirmar ────────────────────────────────────────────────────
    if ($action === 'confirmar') {

        if (empty($input['items']) || !is_array($input['items'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'El campo "items" es obligatorio y debe ser un array.']);
            exit;
        }
        if (!isset($input['total_pedido']) || !is_numeric($input['total_pedido'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'El campo "total_pedido" es obligatorio.']);
            exit;
        }

        $usuarioId   = isset($input['usuario_id']) ? (int) $input['usuario_id'] : null;
        $totalPedido = (int)   $input['total_pedido'];
        $climaPedir  = $input['clima_al_pedir'] ?? null;
        $tempPedir   = isset($input['temp_al_pedir']) ? (float) $input['temp_al_pedir'] : null;
        $items       = $input['items'];

        try {
            // ── Transacción atómica: pedido + detalle + descuento stock ───────
            $conn->beginTransaction();

            // 1. Crear cabecera del pedido
            $conn->prepare("
                INSERT INTO ven_pedidos
                    (usuario_id, total_pedido, estado, clima_al_pedir, temp_al_pedir, creado_en)
                VALUES
                    (:usuario_id, :total_pedido, 'pendiente', :clima, :temp, NOW())
            ")->execute([
                ':usuario_id'   => $usuarioId,
                ':total_pedido' => $totalPedido,
                ':clima'        => $climaPedir,
                ':temp'         => $tempPedir,
            ]);
            $pedidoId = (int) $conn->lastInsertId();

            // 2. Insertar líneas de detalle
            $stmtDetalle = $conn->prepare("
                INSERT INTO ven_detalle_pedido
                    (pedido_id, plato_id, cantidad, precio_unit, subtotal)
                VALUES
                    (:pedido_id, :plato_id, :cantidad, :precio_unit, :subtotal)
            ");
            foreach ($items as $item) {
                if (!isset($item['plato_id'], $item['cantidad'], $item['precio_unit'])) {
                    $conn->rollBack();
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Cada ítem necesita plato_id, cantidad y precio_unit.']);
                    exit;
                }
                $cantidad    = (int) $item['cantidad'];
                $precioUnit  = (int) $item['precio_unit'];
                $stmtDetalle->execute([
                    ':pedido_id'   => $pedidoId,
                    ':plato_id'    => (int) $item['plato_id'],
                    ':cantidad'    => $cantidad,
                    ':precio_unit' => $precioUnit,
                    ':subtotal'    => $cantidad * $precioUnit,
                ]);
            }

            // 3. ── T2.5: Descuento automático de stock FIFO ──────────────────
            $resultadoStock = descontarStockPorPedido($conn, $pedidoId);

            $conn->commit();

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'data'    => [
                    'pedido_id'       => $pedidoId,
                    'estado'          => 'pendiente',
                    'stock_resultado' => $resultadoStock,
                ],
                'meta'    => ['generado_en' => date('c')],
                'error'   => null,
                'message' => 'Pedido confirmado. Stock descontado automáticamente.',
            ]);

        } catch (\RuntimeException $e) {
            if ($conn->inTransaction()) $conn->rollBack();
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        } catch (\PDOException $e) {
            if ($conn->inTransaction()) $conn->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Error de BD: ' . $e->getMessage()]);
        }
    }

    // ── ACCIÓN: marcar_listo ─────────────────────────────────────────────────
    elseif ($action === 'marcar_listo') {
        if (!isset($input['pedido_id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Falta el parámetro "pedido_id"']);
            exit;
        }
        $pedidoId = (int) $input['pedido_id'];

        try {
            $conn->prepare("UPDATE ven_pedidos SET estado = 'servido' WHERE id = :id")
                 ->execute([':id' => $pedidoId]);

            // Notificación simulada (log de email)
            $logMsg = "[" . date('Y-m-d H:i:s') . "] EMAIL ENVIADO: "
                    . "Tu pedido #{$pedidoId} está LISTO para servir/retirar.\n";
            file_put_contents(__DIR__ . '/../notificaciones_email.log', $logMsg, FILE_APPEND);

            echo json_encode([
                'success' => true,
                'data'    => ['pedido_id' => $pedidoId, 'estado' => 'servido'],
                'meta'    => ['generado_en' => date('c')],
                'error'   => null,
                'message' => 'Pedido marcado como listo y notificación enviada.',
            ]);

        } catch (\PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Error de BD: ' . $e->getMessage()]);
        }
    }

    else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Acción '{$action}' no soportada. Use: confirmar | marcar_listo"]);
    }
}

// ============================================================================
// Método no soportado
// ============================================================================
else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
}
