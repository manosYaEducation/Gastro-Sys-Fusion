# API Contract — Gastro-Sys-Fusion (documento vivo)

> **Versión:** 1.0 · **Actualizado:** 2026-05-25  
> Este documento describe el contrato de API entre el frontend (HTML/JS → Next.js) y el backend PHP.  
> Todos los endpoints respetan el mismo formato de respuesta estándar.

---

## Formato estándar de respuesta

Todos los endpoints devuelven **siempre** este envelope JSON:

```json
{
  "success": true,
  "data":    [],
  "meta":    { "total": 0, "generado_en": "ISO8601" },
  "error":   null
}
```

| Campo        | Tipo            | Descripción                                  |
|--------------|-----------------|----------------------------------------------|
| `success`    | `boolean`       | `true` si la operación tuvo éxito            |
| `data`       | `array`         | Resultado de la consulta (vacío si error)    |
| `meta.total` | `integer`       | Número de elementos en `data`                |
| `meta.generado_en` | `string` | Timestamp ISO 8601 de cuando se generó       |
| `error`      | `string\|null`  | Mensaje de error legible, `null` si éxito    |

---

## Endpoints PHP (Backend → Frontend / Agente)

### GET /api/clima.php

Devuelve el clima actual del restaurante.  
Internamente usa OpenWeatherMap + motor de reglas de recomendación.

**Parámetros:** ninguno  
**Autenticación:** pública

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": [{
    "temperatura": 12.5,
    "condicion":   "frio",
    "descripcion": "Cielo nublado",
    "ciudad":      "Santiago,CL",
    "fuente":      "openweathermap",
    "sensacion":   11.0,
    "humedad":     75
  }],
  "meta": { "total": 1, "generado_en": "2026-05-25T13:00:00-04:00", "fuente": "openweathermap" },
  "error": null
}
```

**Valores de `condicion`:**

| Valor      | Criterio                                              |
|------------|-------------------------------------------------------|
| `lluvia`   | OWM reporta Rain / Drizzle / Thunderstorm / Snow      |
| `frio`     | temperatura < 15 °C y sin lluvia                      |
| `sol`      | temperatura > 25 °C y sin lluvia                      |
| `templado` | 15 °C ≤ temperatura ≤ 25 °C y sin lluvia              |

---

### GET /api/menu.php

Devuelve los platos recomendados según el clima.

**Parámetros de query:**

| Param       | Tipo     | Requerido | Descripción                          |
|-------------|----------|-----------|--------------------------------------|
| `clima`     | `float`  | No        | Temperatura en °C                    |
| `condicion` | `string` | No        | `lluvia` \| `sol` \| `frio` \| `templado` |

> Si no se pasan parámetros, el endpoint consulta `/api/clima.php` internamente y aplica el motor de reglas.

**Ejemplo:**
```
GET /api/menu.php?clima=10&condicion=frio
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "Tagliatelle al Ragù Bolognese",
      "precio": 16900,
      "imagen_url": "plato_pasta.png",
      "clima_recomendar": "frio",
      "recomendado_por_clima": true,
      "tiene_stock": true,
      "insumos_agotados": 0,
      "categoria": "Pastas"
    }
  ],
  "meta": {
    "total": 7,
    "total_recomendados": 4,
    "generado_en": "2026-05-25T13:00:00-04:00",
    "condicion": "frio",
    "temperatura": 10,
    "fuente_clima": "parametro"
  },
  "error": null
}
```

> **Reglas de negocio (T1.2):**
> - Solo se incluyen platos con `disponible = 1` **Y** `tiene_stock = true` (stock suficiente en todos los insumos de la receta).
> - Platos con al menos un insumo agotado (`stock_actual < cantidad_receta`) se excluyen silenciosamente.
> - El campo `recomendado_por_clima: true/false` indica si el plato calza con la condición climática solicitada.
> - Los platos se devuelven ordenados: recomendados primero, luego el resto (ambos grupos con stock suficiente).
> - Si no se pasan parámetros, el endpoint auto-detecta el clima vía `/api/clima.php`.

---

### GET /api/platos.php

Devuelve el catálogo completo de platos (sin filtro de clima).

**Parámetros de query:**

| Param        | Tipo      | Default | Descripción                      |
|--------------|-----------|---------|----------------------------------|
| `disponible` | `boolean` | `true`  | Filtrar solo platos disponibles  |
| `destacados` | `1\|0`   | —       | Filtrar solo platos destacados   |

**Ejemplo:**
```
GET /api/platos.php?disponible=true
```

---

### POST /api/agente/query.php

Bridge seguro entre el agente Next.js y la base de datos.  
Ejecuta únicamente consultas `SELECT` sobre tablas del dominio gastronómico.

**Autenticación:** CORS restringido a `FRONTEND_URL` del `.env`  
**Content-Type:** `application/json`

**Body:**
```json
{
  "sql":    "SELECT id, nombre, precio FROM cat_platos WHERE disponible = 1",
  "params": []
}
```

**Tablas autorizadas:** `cat_platos`, `cat_categorias`, `inv_insumos`, `inv_recetas`, `ven_pedidos`, `ven_detalle_pedido`

**Restricciones de seguridad:**
- Solo `SELECT` — cualquier otra sentencia devuelve HTTP 403
- Palabras prohibidas: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `ALTER`, `CREATE`, `EXEC`, `GRANT`, `REVOKE`, `CALL`, `LOAD`, `INTO OUTFILE`
- Límite automático de 200 filas si no hay `LIMIT`
- Usa PDO prepared statements

---

## Endpoint del Agente (Next.js)

```
POST http://localhost:3000/api/chat
```

**Body:**
```json
{
  "message":    "¿Qué platos recomiendas para un día frío?",
  "session_id": "uuid-v4"
}
```

**Respuesta:**
```json
{
  "reply":     "Te recomiendo el Ramen Tonkotsu Ahumado y el Gnocchi...",
  "tool_used": "menu_clima",
  "data":      {}
}
```

---

## Variables de entorno requeridas

```env
OPENWEATHERMAP_API_KEY=tu_api_key_aqui    # https://openweathermap.org/api (gratuito)
CIUDAD_RESTAURANTE=Santiago,CL            # Ciudad para la consulta OWM
FRONTEND_URL=http://localhost:3000        # CORS para /api/agente/query.php
```

---

## Mapa de archivos

```
Gastro-Sys-Fusion/
├── api/
│   ├── clima.php               ← GET /api/clima.php
│   ├── menu.php                ← GET /api/menu.php?clima=&condicion=
│   ├── platos.php              ← GET /api/platos.php?disponible=true
│   └── agente/
│       └── query.php           ← POST /api/agente/query.php
├── backend/
│   ├── lib/
│   │   ├── clima.php           ← Módulo OWM + motor de reglas
│   │   └── respuesta.php       ← Helper formato estándar
│   └── conexion.php
└── frontend/js/
    ├── config.js               ← window.API con URLs centralizadas
    └── platos.js               ← Consume /api/clima.php, /api/menu.php, /api/platos.php
```
