<?php
require 'backend/conexion.php';
try {
    // Limpiar para evitar duplicados si se corre de nuevo
    $conn->exec("DELETE FROM ven_detalle_pedido WHERE pedido_id IN (1,2,3,4,5,6)");
    $conn->exec("DELETE FROM ven_pedidos WHERE id IN (1,2,3,4,5,6)");

    // Insertar 6 pedidos con diferentes tiempos para ver los colores del dashboard (Verde, Naranja, Rojo)
    $sql = "INSERT INTO ven_pedidos (id, total_pedido, estado, creado_en) 
            VALUES 
            (1, 38400, 'en_preparacion', DATE_SUB(NOW(), INTERVAL 18 MINUTE)), 
            (2, 16900, 'en_preparacion', DATE_SUB(NOW(), INTERVAL 16 MINUTE)),
            (3, 21500, 'pendiente', DATE_SUB(NOW(), INTERVAL 12 MINUTE)),
            (4, 55300, 'en_preparacion', DATE_SUB(NOW(), INTERVAL 11 MINUTE)),
            (5, 16900, 'pendiente', DATE_SUB(NOW(), INTERVAL 5 MINUTE)),
            (6, 43000, 'pendiente', DATE_SUB(NOW(), INTERVAL 1 MINUTE))";
    $conn->exec($sql);

    // Insertar el detalle (platos) para esos pedidos
    $sql2 = "INSERT INTO ven_detalle_pedido (pedido_id, plato_id, cantidad, precio_unit, subtotal) 
             VALUES 
             (1, 1, 1, 16900, 16900), 
             (1, 2, 1, 21500, 21500), 
             
             (2, 1, 1, 16900, 16900),
             
             (3, 2, 1, 21500, 21500),
             
             (4, 1, 2, 16900, 33800),
             (4, 2, 1, 21500, 21500),
             
             (5, 1, 1, 16900, 16900),
             
             (6, 2, 2, 21500, 43000)";
    $conn->exec($sql2);
    
    echo "Seed OK: 6 pedidos creados con diferentes tiempos.";
} catch(PDOException $e) {
    echo "Error: " . $e->getMessage();
}
