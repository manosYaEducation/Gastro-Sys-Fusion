<?php
/**
 * api/historial_pedidos.php
 * Endpoint para US-H1.5 (Historial del Cliente)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../backend/conexion.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Simulamos que el usuario logueado es el ID 1, a menos que se mande por GET
$usuarioId = isset($_GET['usuario_id']) ? (int)$_GET['usuario_id'] : 1;

try {
    // 1. Traer todos los pedidos de este usuario (sin importar el estado), ordenados del más reciente al más antiguo
    $sql = "
        SELECT id, total_pedido, estado, creado_en 
        FROM ven_pedidos 
        WHERE usuario_id = :usuario_id
        ORDER BY creado_en DESC
    ";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':usuario_id' => $usuarioId]);
    $pedidos = $stmt->fetchAll();

    // 2. Traer el detalle de platos de cada pedido
    foreach ($pedidos as &$pedido) {
        $sqlDetalle = "
            SELECT d.id, d.plato_id, d.cantidad, d.precio_unit, p.nombre, p.imagen_url 
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
        'error'   => null
    ]);

} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de BD', 'message' => $e->getMessage()]);
}
