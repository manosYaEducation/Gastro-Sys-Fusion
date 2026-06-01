<?php
/**
 * backend/lib/descuento_stock.php
 *
 * T2.5 — Descuento Automático de Stock por Venta (US-5.1)
 *
 * Función principal: descontarStockPorPedido($conn, $pedidoId)
 *
 * Algoritmo:
 *  1. Obtiene todos los ítems del ven_detalle_pedido para el pedido dado.
 *  2. Para cada ítem, busca la receta del plato (inv_recetas).
 *  3. Para cada insumo de la receta, descuenta en FIFO (primero vence primero)
 *     de los lotes disponibles en inv_lotes_insumo.
 *  4. Recalcula inv_insumos.stock_actual (SUM de todos sus lotes).
 *  5. Si stock_actual llega a 0, marca cat_platos.disponible = 0.
 *  6. Registra el movimiento en inv_movimientos_stock para trazabilidad.
 *  7. Si algún insumo cruza su umbral mínimo, inserta en inv_alertas_inventario.
 *
 * Devuelve un array con:
 *  - 'movimientos'    : array de cada descuento realizado por insumo
 *  - 'platos_agotados': array de plato_id marcados como disponible = 0
 *  - 'alertas_stock'  : array de insumos que cruzaron su umbral mínimo
 *
 * @param  PDO $conn     Conexión PDO activa (debe estar dentro de una transacción).
 * @param  int $pedidoId ID del pedido a procesar.
 * @return array
 * @throws RuntimeException Si el pedido no existe o ya fue procesado.
 */

function descontarStockPorPedido(PDO $conn, int $pedidoId): array
{
    // ── 0. Validar que el pedido existe y está en estado procesable ──────────
    $stmtPedido = $conn->prepare("
        SELECT id, estado FROM ven_pedidos WHERE id = :id FOR UPDATE
    ");
    $stmtPedido->execute([':id' => $pedidoId]);
    $pedido = $stmtPedido->fetch();

    if (!$pedido) {
        throw new RuntimeException("Pedido #{$pedidoId} no encontrado.");
    }

    // Solo procesamos pedidos en estado confirmable.
    // 'servido' o 'pagado' ya habrían sido procesados.
    $estadosProcesables = ['pendiente', 'en_preparacion'];
    if (!in_array($pedido['estado'], $estadosProcesables, true)) {
        throw new RuntimeException(
            "El pedido #{$pedidoId} ya fue procesado (estado: {$pedido['estado']})."
        );
    }

    // ── 1. Obtener los ítems del pedido ─────────────────────────────────────
    $stmtItems = $conn->prepare("
        SELECT plato_id, cantidad AS porciones
        FROM   ven_detalle_pedido
        WHERE  pedido_id = :pedido_id
    ");
    $stmtItems->execute([':pedido_id' => $pedidoId]);
    $items = $stmtItems->fetchAll();

    $movimientos    = [];
    $platosAgotados = [];
    $alertasStock   = [];

    // ── 2. Por cada ítem vendido ─────────────────────────────────────────────
    foreach ($items as $item) {
        $platoId   = (int) $item['plato_id'];
        $porciones = (int) $item['porciones'];

        // ── 2a. Obtener la receta del plato ───────────────────────────────────
        $stmtReceta = $conn->prepare("
            SELECT r.insumo_id,
                   r.cantidad       AS cantidad_por_porcion,
                   i.nombre         AS insumo_nombre,
                   i.stock_actual,
                   i.stock_minimo,
                   i.unidad_medida
            FROM   inv_recetas r
            JOIN   inv_insumos i ON i.id = r.insumo_id
            WHERE  r.plato_id = :plato_id
        ");
        $stmtReceta->execute([':plato_id' => $platoId]);
        $ingredientes = $stmtReceta->fetchAll();

        // ── 2b. Por cada ingrediente de la receta ─────────────────────────────
        foreach ($ingredientes as $ingrediente) {
            $insumoId        = (int)   $ingrediente['insumo_id'];
            $cantidadPorcion = (float) $ingrediente['cantidad_por_porcion'];
            $stockMinimo     = (float) $ingrediente['stock_minimo'];

            // Total a descontar para las N porciones vendidas
            $totalADescontar = $cantidadPorcion * $porciones;

            if ($totalADescontar <= 0) {
                continue;
            }

            // ── 2c. Obtener lotes disponibles en orden FIFO ───────────────────
            // FEFO: primero el que vence antes. Lotes sin vencimiento al final.
            $stmtLotes = $conn->prepare("
                SELECT id, cantidad AS stock_lote
                FROM   inv_lotes_insumo
                WHERE  insumo_id = :insumo_id
                  AND  cantidad  > 0
                ORDER BY
                    CASE WHEN fecha_vencimiento IS NULL THEN 1 ELSE 0 END ASC,
                    fecha_vencimiento ASC,
                    id ASC
                FOR UPDATE
            ");
            $stmtLotes->execute([':insumo_id' => $insumoId]);
            $lotes = $stmtLotes->fetchAll();

            $pendiente = $totalADescontar; // Cantidad que falta descontar

            // ── 2d. Descontar de los lotes en orden FIFO ──────────────────────
            foreach ($lotes as $lote) {
                if ($pendiente <= 0) break;

                $loteId       = (int)   $lote['id'];
                $stockLote    = (float) $lote['stock_lote'];

                // Cuánto tomamos de este lote
                $consumido     = min($pendiente, $stockLote);
                $stockLotePost = round($stockLote - $consumido, 3);

                // Actualizar cantidad del lote
                $conn->prepare("
                    UPDATE inv_lotes_insumo
                    SET    cantidad = :nuevo_stock
                    WHERE  id = :id
                ")->execute([':nuevo_stock' => $stockLotePost, ':id' => $loteId]);

                $pendiente = round($pendiente - $consumido, 3);
            }

            // ── 2e. Recalcular stock_actual del insumo (SUM de lotes) ─────────
            $stmtSuma = $conn->prepare("
                SELECT COALESCE(SUM(cantidad), 0) AS total
                FROM   inv_lotes_insumo
                WHERE  insumo_id = :insumo_id
            ");
            $stmtSuma->execute([':insumo_id' => $insumoId]);
            $nuevoStockInsumo = round((float) $stmtSuma->fetchColumn(), 3);

            $conn->prepare("
                UPDATE inv_insumos
                SET    stock_actual = :nuevo_stock
                WHERE  id = :id
            ")->execute([':nuevo_stock' => $nuevoStockInsumo, ':id' => $insumoId]);

            // ── 2f. Registrar movimiento de trazabilidad ──────────────────────
            $cantidadDescontada = round($totalADescontar - max($pendiente, 0), 3);

            $conn->prepare("
                INSERT INTO inv_movimientos_stock
                    (pedido_id, insumo_id, lote_id, cantidad_usada,
                     stock_lote_ant, stock_lote_post, stock_insumo_post, motivo)
                VALUES
                    (:pedido_id, :insumo_id, NULL, :cantidad_usada,
                     0, 0, :stock_insumo_post, 'venta')
            ")->execute([
                ':pedido_id'         => $pedidoId,
                ':insumo_id'         => $insumoId,
                ':cantidad_usada'    => $cantidadDescontada,
                ':stock_insumo_post' => $nuevoStockInsumo,
            ]);

            $movimientos[] = [
                'insumo_id'           => $insumoId,
                'insumo_nombre'       => $ingrediente['insumo_nombre'],
                'cantidad_descontada' => $cantidadDescontada,
                'stock_anterior'      => (float) $ingrediente['stock_actual'],
                'stock_actual'        => $nuevoStockInsumo,
                'pendiente_sin_stock' => max($pendiente, 0),
            ];

            // ── 2g. Alerta si el insumo cruzó el umbral mínimo ───────────────
            $stockAnterior = (float) $ingrediente['stock_actual'];
            if ($nuevoStockInsumo <= $stockMinimo && $stockAnterior > $stockMinimo) {
                $msg = "Stock de '{$ingrediente['insumo_nombre']}' bajó al mínimo "
                     . "({$nuevoStockInsumo} {$ingrediente['unidad_medida']}). "
                     . "Pedido #{$pedidoId}.";

                $conn->prepare("
                    INSERT INTO inv_alertas_inventario
                        (insumo_id, tipo_alerta, mensaje, resuelta)
                    VALUES
                        (:insumo_id, 'stock_minimo', :mensaje, 0)
                ")->execute([':insumo_id' => $insumoId, ':mensaje' => $msg]);

                $alertasStock[] = [
                    'insumo_id'    => $insumoId,
                    'nombre'       => $ingrediente['insumo_nombre'],
                    'stock_actual' => $nuevoStockInsumo,
                    'stock_minimo' => $stockMinimo,
                ];
            }
        } // fin foreach ingrediente

        // ── 3. Marcar plato como agotado si algún insumo llegó a 0 ──────────
        $stmtVerStock = $conn->prepare("
            SELECT r.insumo_id, i.stock_actual, i.nombre
            FROM   inv_recetas r
            JOIN   inv_insumos i ON i.id = r.insumo_id
            WHERE  r.plato_id = :plato_id
              AND  i.stock_actual <= 0
            LIMIT 1
        ");
        $stmtVerStock->execute([':plato_id' => $platoId]);
        $insumoAgotado = $stmtVerStock->fetch();

        if ($insumoAgotado) {
            $conn->prepare("
                UPDATE cat_platos SET disponible = 0 WHERE id = :id
            ")->execute([':id' => $platoId]);

            $platosAgotados[] = [
                'plato_id'       => $platoId,
                'insumo_critico' => $insumoAgotado['nombre'],
            ];
        }

    } // fin foreach item

    return [
        'movimientos'     => $movimientos,
        'platos_agotados' => $platosAgotados,
        'alertas_stock'   => $alertasStock,
    ];
}
