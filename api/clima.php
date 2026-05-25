<?php
/**
 * api/clima.php
 *
 * GET /api/clima.php
 *
 * Devuelve el clima actual del restaurante aplicando el motor de reglas.
 *
 * Respuesta exitosa:
 * {
 *   "success": true,
 *   "data": {
 *     "temperatura": 12.5,
 *     "condicion":   "frio",       ← 'lluvia' | 'frio' | 'sol' | 'templado'
 *     "descripcion": "Cielo despejado",
 *     "ciudad":      "Santiago,CL",
 *     "fuente":      "openweathermap" | "fallback"
 *   },
 *   "meta": { "total": 1, "generado_en": "2026-05-25T13:00:00-04:00" },
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

require_once __DIR__ . '/../backend/lib/respuesta.php';
require_once __DIR__ . '/../backend/lib/clima.php';

try {
    $clima = obtenerClimaActual();

    // Exponer sólo los campos públicos del contrato
    $data = [
        'temperatura' => $clima['temperatura'],
        'condicion'   => $clima['condicion'],
        'descripcion' => $clima['descripcion'],
        'ciudad'      => $clima['ciudad'],
        'fuente'      => $clima['fuente'],
        'sensacion'   => $clima['sensacion'],
        'humedad'     => $clima['humedad'],
    ];

    respuestaOk([$data], ['fuente' => $clima['fuente']]);

} catch (\Throwable $e) {
    respuestaError('No se pudo obtener el clima: ' . $e->getMessage(), 500);
}
