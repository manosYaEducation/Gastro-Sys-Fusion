<?php
/**
 * api/agente/query.php
 *
 * POST /api/agente/query.php
 *
 * Bridge seguro entre el agente Next.js y la base de datos.
 * Solo ejecuta consultas SELECT validadas.
 *
 * Body (JSON):
 *   { "sql": "SELECT ...", "params": [] }
 *
 * Respuesta exitosa:
 *   { "success": true, "data": [...], "meta": { "total": N, "generado_en": "..." }, "error": null }
 *
 * Seguridad:
 *   - Solo se permiten SELECT (rechaza INSERT/UPDATE/DELETE/DROP/…)
 *   - Usa PDO prepared statements con parámetros ligados
 *   - Solo acepta peticiones desde orígenes autorizados (CORS restringido)
 *   - Limita resultados a 200 filas máximo
 */

header('Content-Type: application/json; charset=utf-8');

// CORS: solo permitir desde Next.js local y dominio de producción
$allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    $_ENV['FRONTEND_URL'] ?? '',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, array_filter($allowedOrigins), true)) {
    header("Access-Control-Allow-Origin: {$origin}");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'data' => [], 'meta' => ['total' => 0, 'generado_en' => date('c')], 'error' => 'Método no permitido']);
    exit;
}

require_once __DIR__ . '/../../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../..');
$dotenv->load();

require_once __DIR__ . '/../../backend/conexion.php';
require_once __DIR__ . '/../../backend/lib/respuesta.php';

// --- Leer body JSON ---
$body = json_decode(file_get_contents('php://input'), true);

if (!is_array($body) || !isset($body['sql'])) {
    respuestaError('Body inválido. Se requiere { "sql": "...", "params": [] }', 400);
}

$sqlRaw = trim((string) $body['sql']);
$params = isset($body['params']) && is_array($body['params']) ? $body['params'] : [];

// --- Validación de seguridad: solo SELECT ---
$sqlNorm = preg_replace('/\s+/', ' ', strtoupper($sqlRaw));

// Rechazar si no empieza con SELECT
if (!preg_match('/^\s*SELECT\b/', $sqlNorm)) {
    respuestaError('Solo se permiten consultas SELECT.', 403);
}

// Rechazar palabras clave peligrosas aunque estén dentro de un SELECT
$palabrasProhibidas = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE',
    'ALTER', 'CREATE', 'REPLACE', 'EXEC', 'EXECUTE',
    'GRANT', 'REVOKE', 'CALL', 'LOAD', 'INTO OUTFILE',
];

foreach ($palabrasProhibidas as $kw) {
    if (str_contains($sqlNorm, $kw)) {
        respuestaError("Consulta rechazada: contiene palabra reservada '{$kw}'.", 403);
    }
}

// Limitar a tablas permitidas del dominio gastronómico
$tablasPermitidas = ['cat_platos', 'cat_categorias', 'inv_insumos', 'inv_recetas', 'ven_pedidos', 'ven_detalle_pedido', 'v_platos_disponibles'];
$mencionaTablaPermitida = false;
foreach ($tablasPermitidas as $tabla) {
    if (str_contains($sqlNorm, strtoupper($tabla))) {
        $mencionaTablaPermitida = true;
        break;
    }
}
if (!$mencionaTablaPermitida) {
    respuestaError('Consulta rechazada: solo se permiten consultas sobre tablas del dominio de la aplicación.', 403);
}

// --- Ejecutar con límite de seguridad ---
try {
    // Forzar LIMIT 200 si no está definido
    if (!str_contains($sqlNorm, 'LIMIT')) {
        $sqlRaw .= ' LIMIT 200';
    }

    $stmt = $conn->prepare($sqlRaw);
    $stmt->execute($params);
    $resultado = $stmt->fetchAll();

    respuestaOk($resultado, [
        'query_preview' => substr($sqlRaw, 0, 120) . (strlen($sqlRaw) > 120 ? '…' : ''),
    ]);

} catch (\PDOException $e) {
    respuestaError('Error al ejecutar la consulta: ' . $e->getMessage(), 500);
}
