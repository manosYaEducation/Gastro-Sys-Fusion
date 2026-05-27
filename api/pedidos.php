<?php
/**
 * api/pedidos.php
 * Endpoint para el Dashboard de Cocina (US-H1.4)
 * 
 * GET: Devuelve pedidos activos (pendiente o en_preparacion) con sus detalles.
 * POST: Actualiza el estado de un pedido (ej. a "servido" / Listo) y envía notificación.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../backend/conexion.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        // Obtener pedidos activos
        $sql = "
            SELECT id, usuario_id, total_pedido, estado, creado_en 
            FROM ven_pedidos 
            WHERE estado IN ('pendiente', 'en_preparacion')
            ORDER BY creado_en ASC
        ";
        $stmt = $conn->query($sql);
        $pedidos = $stmt->fetchAll();

        // Para cada pedido, obtener los detalles (platos)
        foreach ($pedidos as &$pedido) {
            $sqlDetalle = "
                SELECT d.id, d.plato_id, d.cantidad, p.nombre 
                FROM ven_detalle_pedido d
                JOIN cat_platos p ON p.id = d.plato_id
                WHERE d.pedido_id = :pedido_id
            ";
            $stmtDetalle = $conn->prepare($sqlDetalle);
            $stmtDetalle->execute([':pedido_id' => $pedido['id']]);
            $pedido['platos'] = $stmtDetalle->fetchAll();
        }

        echo json_encode([
            'success' => true,
            'data'    => $pedidos,
            'meta'    => ['total' => count($pedidos), 'generado_en' => date('c')],
            'error'   => null
        ]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error de BD', 'message' => $e->getMessage()]);
    }
} 
elseif ($method === 'POST') {
    try {
        // Leer el body JSON
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['pedido_id']) || !isset($input['action'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Faltan parámetros']);
            exit;
        }

        $pedidoId = (int)$input['pedido_id'];
        $action = $input['action'];

        if ($action === 'marcar_listo') {
            // Actualizar estado en DB
            $sql = "UPDATE ven_pedidos SET estado = 'servido' WHERE id = :id";
            $stmt = $conn->prepare($sql);
            $stmt->execute([':id' => $pedidoId]);

            // SIMULACIÓN DE NOTIFICACIÓN DE PEDIDO LISTO
            // Se guardará un log en un archivo local simulando el envío de correo.
            $logMsg = "[" . date('Y-m-d H:i:s') . "] EMAIL ENVIADO: Tu pedido #" . $pedidoId . " está LISTO para servir/retirar.\n";
            file_put_contents(__DIR__ . '/../notificaciones_email.log', $logMsg, FILE_APPEND);

            echo json_encode([
                'success' => true,
                'data'    => ['pedido_id' => $pedidoId, 'estado' => 'servido'],
                'meta'    => ['generado_en' => date('c')],
                'error'   => null,
                'message' => 'Pedido marcado como listo y notificación enviada.'
            ]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Acción no soportada']);
        }

    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error de BD', 'message' => $e->getMessage()]);
    }
}
else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
}
