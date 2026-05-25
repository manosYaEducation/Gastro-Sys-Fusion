<?php
/**
 * get_platos.php
 * Devuelve los platos disponibles (opcionalmente solo los destacados).
 *
 * GET /backend/get_platos.php            → todos los disponibles
 * GET /backend/get_platos.php?destacados=1 → solo los destacados
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/conexion.php';

$soloDestacados = isset($_GET['destacados']) && $_GET['destacados'] == '1';

try {
    $sql = "
        SELECT
            p.id,
            p.nombre,
            p.descripcion,
            p.precio,
            p.imagen_url,
            p.calorias,
            p.tiempo_min,
            p.destacado,
            p.clima_recomendar,
            p.temp_min_recomendar,
            p.temp_max_recomendar,
            c.nombre AS categoria
        FROM cat_platos p
        LEFT JOIN cat_categorias c ON c.id = p.categoria_id
        WHERE p.disponible = 1
    ";

    if ($soloDestacados) {
        $sql .= " AND p.destacado = 1";
    }

    $sql .= " ORDER BY p.destacado DESC, p.id ASC";

    $stmt = $conn->query($sql);
    $platos = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'data'    => $platos
    ]);

} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Error al obtener los platos',
        'message' => $e->getMessage()
    ]);
}
