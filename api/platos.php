<?php
/**
 * api/platos.php
 *
 * GET /api/platos.php
 * GET /api/platos.php?disponible=true
 * GET /api/platos.php?destacados=1
 *
 * Devuelve el catálogo completo con estado de stock por plato.
 * Incluye recomendado_por_clima si se pasa ?condicion=
 *
 * Respuesta incluye para cada plato:
 *   - tiene_stock:           true/false  (disponible + stock suficiente)
 *   - insumos_agotados:      N           (cuántos insumos sin stock)
 *   - recomendado_por_clima: true/false  (si se pasó ?condicion=)
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
    // ── Parámetros ──────────────────────────────────────────────────────────
    $soloDisponibles = !isset($_GET['disponible']) || $_GET['disponible'] === 'true';
    $soloDestacados  = isset($_GET['destacados']) && $_GET['destacados'] == '1';
    // Condición de clima opcional: añade recomendado_por_clima en la respuesta
    $condicion       = isset($_GET['condicion']) ? strtolower(trim($_GET['condicion'])) : null;

    // ── Construir WHERE ─────────────────────────────────────────────────────
    $where  = [];
    if ($soloDisponibles) $where[] = 'disponible = 1';
    if ($soloDestacados)  $where[] = 'destacado = 1';

    $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $sql = "
        SELECT
            id,
            nombre,
            descripcion,
            precio,
            imagen_url,
            calorias,
            tiempo_min,
            destacado,
            disponible,
            clima_recomendar,
            temp_min_recomendar,
            temp_max_recomendar,
            categoria,
            tiene_stock,
            insumos_agotados
        FROM v_platos_disponibles
        {$whereSQL}
        ORDER BY destacado DESC, id ASC
    ";

    $stmt   = $conn->query($sql);
    $platos = $stmt->fetchAll();

    // ── Normalizar tipos y añadir recomendado_por_clima ────────────────────
    $tagsClima = $condicion ? condicionATagsDB($condicion) : [];

    $platosConFlag = array_map(function (array $plato) use ($tagsClima): array {
        $campoClima = strtolower((string) ($plato['clima_recomendar'] ?? ''));
        $tagsPlato  = array_map('trim', explode(',', $campoClima));

        $esRecomendado = !empty($tagsClima) && !empty(array_intersect($tagsPlato, $tagsClima));

        return array_merge($plato, [
            'tiene_stock'           => (bool) $plato['tiene_stock'],
            'insumos_agotados'      => (int)  $plato['insumos_agotados'],
            'recomendado_por_clima' => $esRecomendado,
        ]);
    }, $platos);

    $meta = [
        'filtros' => [
            'disponible' => $soloDisponibles,
            'destacados' => $soloDestacados,
        ],
        'con_stock'    => count(array_filter($platosConFlag, fn($p) => $p['tiene_stock'])),
        'agotados'     => count(array_filter($platosConFlag, fn($p) => !$p['tiene_stock'])),
    ];

    if ($condicion) {
        $meta['condicion']          = $condicion;
        $meta['total_recomendados'] = count(array_filter($platosConFlag, fn($p) => $p['recomendado_por_clima']));
    }

    respuestaOk($platosConFlag, $meta);

} catch (\PDOException $e) {
    respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
} catch (\Throwable $e) {
    respuestaError('Error interno: ' . $e->getMessage(), 500);
}
