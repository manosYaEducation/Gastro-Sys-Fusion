<?php
/**
 * api/menu.php
 *
 * GET /api/menu.php?clima={temp}&condicion={lluvia|sol|frio|templado}
 *
 * Devuelve los platos recomendados según el clima actual.
 * Si no se pasan parámetros, aplica el motor de reglas automáticamente.
 *
 * Query params:
 *   clima     (float, opcional) – temperatura actual en °C
 *   condicion (string, opcional) – 'lluvia' | 'sol' | 'frio' | 'templado'
 *
 * Respuesta exitosa:
 * {
 *   "success": true,
 *   "data":    [ { ...plato } ],
 *   "meta":    { "total": N, "generado_en": "...", "condicion": "frio", "temperatura": 10 },
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
require_once __DIR__ . '/../backend/lib/clima.php';

try {
    // --- 1. Resolver condición y temperatura ---
    $tempParam      = isset($_GET['clima'])     ? (float)  $_GET['clima']     : null;
    $condicionParam = isset($_GET['condicion']) ? (string) $_GET['condicion'] : null;

    if ($condicionParam === null || $tempParam === null) {
        // Auto-detectar con el motor de reglas
        $climaActual    = obtenerClimaActual();
        $temperatura    = $tempParam      ?? $climaActual['temperatura'];
        $condicion      = $condicionParam ?? $climaActual['condicion'];
        $fuenteClima    = $climaActual['fuente'];
    } else {
        $temperatura    = $tempParam;
        $condicion      = $condicionParam;
        $fuenteClima    = 'parametro';
    }

    // Validar condicion
    $condicionesValidas = ['lluvia', 'sol', 'frio', 'templado'];
    if (!in_array($condicion, $condicionesValidas, true)) {
        respuestaError(
            "Condición inválida. Valores permitidos: " . implode(', ', $condicionesValidas),
            400
        );
    }

    // --- 2. Obtener tags de BD para esa condición ---
    $tagsDB = condicionATagsDB($condicion);   // ej: ['lluvioso', 'todos']

    // Construir placeholders para IN(?)
    $placeholders = implode(',', array_fill(0, count($tagsDB), '?'));

    // --- 3. Consultar platos que coincidan ---
    // Usamos FIND_IN_SET para manejar el formato 'calido,templado' en clima_recomendar
    $condSQL = implode(' OR ', array_map(
        fn($tag) => "FIND_IN_SET(?, p.clima_recomendar)",
        $tagsDB
    ));

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
          AND ($condSQL)
        ORDER BY p.destacado DESC, p.id ASC
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute($tagsDB);
    $platos = $stmt->fetchAll();

    respuestaOk($platos, [
        'condicion'   => $condicion,
        'temperatura' => $temperatura,
        'fuente_clima'=> $fuenteClima,
    ]);

} catch (\PDOException $e) {
    respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
} catch (\Throwable $e) {
    respuestaError('Error interno: ' . $e->getMessage(), 500);
}
