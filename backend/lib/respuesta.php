<?php
/**
 * lib/respuesta.php
 * Helper centralizado para el formato estándar de respuesta de la API.
 *
 * Formato garantizado:
 * {
 *   "success": true|false,
 *   "data":    [],
 *   "meta":    { "total": 0, "generado_en": "ISO8601" },
 *   "error":   null | "mensaje"
 * }
 */

/**
 * Envía una respuesta JSON exitosa y termina la ejecución.
 *
 * @param array $data       Datos a devolver en "data".
 * @param array $metaExtra  Campos adicionales para "meta" (ej: clima, filtros).
 */
function respuestaOk(array $data, array $metaExtra = []): void
{
    $meta = array_merge([
        'total'        => count($data),
        'generado_en'  => date('c'),   // ISO 8601
    ], $metaExtra);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data'    => $data,
        'meta'    => $meta,
        'error'   => null,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Envía una respuesta JSON de error y termina la ejecución.
 *
 * @param string $mensaje   Descripción legible del error.
 * @param int    $httpCode  Código HTTP a devolver (400, 403, 500…).
 * @param array  $metaExtra Campos adicionales para "meta".
 */
function respuestaError(string $mensaje, int $httpCode = 500, array $metaExtra = []): void
{
    $meta = array_merge([
        'total'       => 0,
        'generado_en' => date('c'),
    ], $metaExtra);

    http_response_code($httpCode);
    echo json_encode([
        'success' => false,
        'data'    => [],
        'meta'    => $meta,
        'error'   => $mensaje,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
