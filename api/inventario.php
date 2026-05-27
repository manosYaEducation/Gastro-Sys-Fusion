<?php
/**
 * api/inventario.php
 *
 * GET /api/inventario.php
 * GET /api/inventario.php?alerta=stock_minimo
 *
 * Devuelve el listado de insumos con estado de stock.
 *
 * Respuesta incluye para cada insumo:
 *   - stock_actual:   cantidad disponible actualmente
 *   - stock_minimo:   umbral configurado de alerta
 *   - alerta_stock:   true si stock_actual <= stock_minimo
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
    // ── Parámetros ──────────────────────────────────────────────────────────
    // ?alerta=stock_minimo → filtra solo los insumos con stock bajo el mínimo
    $soloEnAlerta = isset($_GET['alerta']) && $_GET['alerta'] === 'stock_minimo';

    // ── Construir WHERE ─────────────────────────────────────────────────────
    $whereSQL = $soloEnAlerta ? 'WHERE stock_actual <= stock_minimo' : '';

    $sql = "
        SELECT
            id,
            nombre,
            unidad_medida,
            stock_actual,
            stock_minimo,
            costo_unitario,
            creado_en
        FROM inv_insumos
        {$whereSQL}
        ORDER BY nombre ASC
    ";

    $stmt    = $conn->query($sql);
    $insumos = $stmt->fetchAll();

    // ── Normalizar tipos y calcular alerta_stock ────────────────────────────
    $insumosConFlag = array_map(function (array $insumo): array {
        $stockActual  = (float) $insumo['stock_actual'];
        $stockMinimo  = (float) $insumo['stock_minimo'];
        $alertaStock  = $stockActual <= $stockMinimo;

        return array_merge($insumo, [
            'stock_actual'   => $stockActual,
            'stock_minimo'   => $stockMinimo,
            'costo_unitario' => $insumo['costo_unitario'] !== null ? (float) $insumo['costo_unitario'] : null,
            'alerta_stock'   => $alertaStock,
        ]);
    }, $insumos);

    // ── Meta ────────────────────────────────────────────────────────────────
    $meta = [
        'filtros' => [
            'alerta' => $soloEnAlerta ? 'stock_minimo' : null,
        ],
        'total'      => count($insumosConFlag),
        'en_alerta'  => count(array_filter($insumosConFlag, fn($i) => $i['alerta_stock'])),
        'ok'         => count(array_filter($insumosConFlag, fn($i) => !$i['alerta_stock'])),
    ];

    respuestaOk($insumosConFlag, $meta);

} catch (\PDOException $e) {
    respuestaError('Error de base de datos: ' . $e->getMessage(), 500);
} catch (\Throwable $e) {
    respuestaError('Error interno: ' . $e->getMessage(), 500);
}
