# 4. Guía Operativa para Desarrolladores PHP

Este documento entrega las directrices, lógicas y reglas de negocio obligatorias que el equipo de desarrollo de PHP debe seguir al interactuar con la base de datos de **Gastro-Sys-Fusion** para la correcta facturación y consistencia en Chile.

---

### 4.1. Flujo de Transacción de Ventas y Cierre Contable
1. **Creación del Pedido:** Se crea una cabecera en `ven_pedidos` con el `total_pedido = 0` y estado `pendiente`.
2. **Registro de Consumo:** Cada ítem insertado en `ven_detalle_pedido` copia el precio actual de `cat_platos.precio` en `precio_unit` y calcula el `subtotal` como `cantidad * precio_unit`. Seguidamente, se actualiza el `total_pedido` de la cabecera acumulando estos montos.
3. **Flujo de Pago (Cuentas Divididas):** 
   - Si el total a pagar del pedido es de `$20.000` y se paga en efectivo con un billete de `$20.000` sugiriendo 10% de propina, el sistema inserta en `ven_pagos`:
     * `monto_comida = 20000`
     * `monto_propina = 2000`
     * `monto_redondeo = 0`
     * `total_pagado = 22000`
   - Si se decide pagar a medias con efectivo, el pago en efectivo gatilla la ley de redondeo: si la mitad de comida son `$10.003` y paga en efectivo, el sistema calcula un `monto_redondeo = -3` para ajustar la decena, persistiendo ese descuadre físico de caja de forma limpia.
4. **Emisión Tributaria (SII):** 
   - Una vez cubierto el total de la comida, se genera el registro en `ven_dtes`.
   - Se calcula el desglose matemático obligatorio del DTE:
     * `total_dte = total_pedido` (La propina NUNCA va dentro del DTE del SII).
     * `monto_neto = ROUND(total_dte / 1.19)`
     * `monto_iva = total_dte - monto_neto` (19% de IVA de Chile).

---

### 4.2. Reglas de Integridad y Resguardo Contable
* **No borrar históricos:** Los pedidos y gastos apuntan a usuarios mediante `ON DELETE SET NULL`. Si eliminas un perfil de usuario, la contabilidad histórica de ventas y egresos no se destruye ni se descuadra.
* **Separación estricta de propinas:** Las propinas registradas en `ven_pagos` no tributan IVA ni deben sumarse al total del reporte diario de ingresos brutos de venta. Se consolidan por separado para la rendición de garzones.
* **Redondeo en Caja:** El campo `monto_redondeo` permite justificar las diferencias de monedas al final de la jornada en el cuadre contable diario (`fin_resumen_diario`).

---

### 4.3. Recomendaciones Técnicas en PHP
1. **Privacidad de Recursos:** Para evitar exponer IDs secuenciales en rutas públicas (ej: `pedido.php?id=5`), usa la librería `hashids` en PHP para ofuscar los números en la URL, o añade una columna indexada secundaria del tipo `uuid VARCHAR(36)`.
2. **Consistencia de Precios:** Al realizar un insert en `ven_detalle_pedido` desde tu código PHP, debes copiar el precio vigente del plato en la columna `precio_unit`. Nunca enlaces el historial de compras directamente al precio actual de la tabla `cat_platos`, ya que si cambias los costos del menú en el futuro, alterarías la contabilidad del pasado de forma destructiva.
