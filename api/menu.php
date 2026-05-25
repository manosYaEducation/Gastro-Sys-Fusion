<?php
/**
 * api/menu.php
 *
 * GET /api/menu.php?clima={temp}&condicion={lluvia|sol|frio|templado}
 *
 * Devuelve los platos del menú dinámico con:
 *   - Filtro de clima (campo recomendado_por_clima: true/false)
 *   - Solo platos con disponible=1 Y stock suficiente (tiene_stock=1)
 *   - Platos agotados excluidos de la respuesta
 *
 * Respuesta exitosa:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "nombre": "...",
 *       "precio": 16900,
 *       "imagen_url": "...",
 *       "recomendado_por_clima": true,   ← NUEVO
 *       "tiene_stock": true,              ← NUEVO (siempre true aquí)
 *       "clima_recomendar": "frio",
 *       ...
 *     }
 *   ],
 *   "meta": {
 *     "total": N,
 *     "total_recomendados": M,
 *     "condicion": "frio",
 *     "temperatura": 10,
 *     "generado_en": "ISO8601"
 *   },
 *   "error": null
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
    // ── 1. Resolver condición y temperatura ────────────────────────────────
    $tempParam      = isset($_GET['clima'])     ? (float)  $_GET['clima']     : null;
    $condicionParam = isset($_GET['condicion']) ? (string) $_GET['condicion'] : null;

    if ($condicionParam === null || $tempParam === null) {
        $climaData   = obtenerClimaActual();
        $temperatura = $tempParam      ?? $climaData['temperatura'];
        $condicion   = $condicionParam ?? $climaData['condicion'];
        $fuenteClima = $climaData['fuente'];
    } else {
        $temperatura = $tempParam;
        $condicion   = $condicionParam;
        $fuenteClima = 'parametro';
    }

    $condicionesValidas = ['lluvia', 'sol', 'frio', 'templado'];
    if (!in_array($condicion, $condicionesValidas, true)) {
        respuestaError(
            "Condición inválida. Valores permitidos: " . implode(', ', $condicionesValidas),
            400
        );
    }

    // ── 2. Tags de BD que corresponden a esta condición ────────────────────
    $tagsClima = condicionATagsDB($condicion);   // ej. ['frio', 'todos']

    // ── 3. Traer TODOS los platos con stock suficiente ─────────────────────
    // Usamos la vista v_platos_disponibles que ya calcula tiene_stock.
    // Excluimos los agotados (tiene_stock = 0).
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
        WHERE disponible = 1
          AND tiene_stock = 1
        ORDER BY destacado DESC, id ASC
    ";

    $stmt   = $conn->query($sql);
    $platos = $stmt->fetchAll();

    // ── 4. Calcular recomendado_por_clima para cada plato ──────────────────
    $platosConFlag = array_map(function (array $plato) use ($tagsClima): array {
        $campoClima = strtolower((string) ($plato['clima_recomendar'] ?? ''));
        $tagsPlato  = array_map('trim', explode(',', $campoClima));

        // Hay match si comparten algún tag
        $esRecomendado = !empty(array_intersect($tagsPlato, $tagsClima));

        return array_merge($plato, [
            'recomendado_por_clima' => $esRecomendado,
            'tiene_stock'           => (bool) $plato['tiene_stock'],
        ]);
    }, $platos);

    // ── 5. Ordenar: recomendados primero, luego el resto ───────────────────
    usort($platosConFlag, function (array $a, array $b): int {
        // Recomendados primero
        $orden = (int) $b['recomendado_por_clima'] <=> (int) $a['recomendado_por_clima'];
        if ($orden !== 0) return $orden;
        // Luego destacados
        return (int) $b['destacado'] <=> (int) $a['destacado'];
    });

    $totalRecomendados = count(array_filter($platosConFlag, fn($p) => $p['recomendado_por_clima']));

    respuestaOk($platosConFlag, [
        'condicion'          => $condicion,
        'temperatura'        => $temperatura,
        'fuente_clima'       => $fuenteClima,
        'total_recomendados' => $totalRecomendados,
    ]);

} catch (\PDOException $e) {
    respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
} catch (\Throwable $e) {
    respuestaError('Error interno: ' . $e->getMessage(), 500);
}
