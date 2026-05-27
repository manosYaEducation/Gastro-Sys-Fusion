<?php
require 'backend/conexion.php';
try {
    // 1. Asegurar que existe el usuario ID 1
    // (Asumimos rol_id = 4 que es cliente en el seed original)
    $stmt = $conn->query("SELECT id FROM auth_usuarios WHERE id = 1");
    if ($stmt->rowCount() === 0) {
        $sqlUser = "INSERT INTO auth_usuarios (id, rol_id, nombre, apellido, email, password_hash) 
                    VALUES (1, 4, 'Usuario', 'Demo', 'demo@cliente.com', 'fakepasshash')";
        $conn->exec($sqlUser);
    }

    // Limpiamos los pedidos de prueba previos
    $conn->exec("DELETE FROM ven_detalle_pedido WHERE pedido_id IN (100, 101)");
    $conn->exec("DELETE FROM ven_pedidos WHERE id IN (100, 101)");

    // 2. Insertamos pedidos falsos en el historial
    $sqlPedidos = "INSERT INTO ven_pedidos (id, usuario_id, total_pedido, estado, creado_en) 
                   VALUES 
                   (100, 1, 38400, 'servido', DATE_SUB(NOW(), INTERVAL 3 DAY)), 
                   (101, 1, 21500, 'en_preparacion', NOW())";
    $conn->exec($sqlPedidos);

    // 3. Insertamos el detalle
    $sqlDetalle = "INSERT INTO ven_detalle_pedido (pedido_id, plato_id, cantidad, precio_unit, subtotal) 
                   VALUES 
                   (100, 1, 1, 16900, 16900), 
                   (100, 2, 1, 21500, 21500), 
                   (101, 2, 1, 21500, 21500)";
    $conn->exec($sqlDetalle);
    
    echo "Seed Historial OK: Creado usuario 1 y 2 pedidos en su historial.";
} catch(PDOException $e) {
    echo "Error: " . $e->getMessage();
}
