<?php
/**
 * api/platos.php
 *
 * GET /api/platos.php
 * GET /api/platos.php?disponible=true
 * GET /api/platos.php?destacados=1
 *
 * Devuelve el catálogo completo de platos (sin filtro de clima).
 * Este es el endpoint "base" que consume el frontend y el agente.
 *
 * Respuesta:
 * {
 *   "success": true,
 *   "data":    [ { ...plato, clima_recomendar, temp_min_recomendar, temp_max_recomendar } ],
 *   "meta":    { "total": N, "generado_en": "..." },
 *   "error":   null
 * }
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

require_once __DIR__ . '/../backend/conexion.php';
require_once __DIR__ . '/../backend/lib/respuesta.php';

try {
    $soloDisponibles  = !isset($_GET['disponible']) || $_GET['disponible'] === 'true';
    $soloDestacados   = isset($_GET['destacados']) && $_GET['destacados'] == '1';

    $where = [];
    $params = [];

    if ($soloDisponibles) {
        $where[] = 'p.disponible = 1';
    }
    if ($soloDestacados) {
        $where[] = 'p.destacado = 1';
    }

    $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

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
        {$whereSQL}
        ORDER BY p.destacado DESC, p.id ASC
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $platos = $stmt->fetchAll();

    respuestaOk($platos, [
        'filtros' => [
            'disponible' => $soloDisponibles,
            'destacados' => $soloDestacados,
        ],
    ]);

} catch (\PDOException $e) {
    respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
} catch (\Throwable $e) {
    respuestaError('Error interno: ' . $e->getMessage(), 500);
}
