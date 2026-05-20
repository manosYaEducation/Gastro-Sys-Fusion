# 3. Diccionario de Datos Técnico Detallado

Este documento contiene la definición y especificación exacta de cada una de las tablas y columnas que componen la base de datos de **Gastro-Sys-Fusion**, adaptada a la legislación contable y tributaria de Chile.

---

### 3.1. Módulo: Usuarios y Accesos (`auth_`)

#### Tabla: `auth_roles`
Define los perfiles de acceso (administrador, gerente, jefe_cocina, cliente).
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador único autoincremental del rol. |
| `nombre` | `VARCHAR(50)` | `NOT NULL` | - | Nombre único del perfil de acceso. |
| `descripcion` | `TEXT` | `NULL` | - | Explicación detallada de los límites de acceso y permisos. |

#### Tabla: `auth_usuarios`
Cuentas de acceso oficiales del sistema.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador autoincremental de la cuenta. |
| `rol_id` | `INT UNSIGNED` | `NOT NULL` | `FK` | Enlace a `auth_roles(id)`. Regla `ON UPDATE CASCADE`. |
| `nombre` | `VARCHAR(100)` | `NOT NULL` | - | Nombre completo del usuario. |
| `email` | `VARCHAR(150)` | `NOT NULL` | `UNIQUE` | Correo electrónico de acceso único del usuario. |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | - | Hash de la contraseña generado mediante `password_hash` de PHP. |
| `creado_en` | `TIMESTAMP` | `NOT NULL` | - | Fecha y hora automática del registro de la cuenta. |

---

### 3.2. Módulo: Catálogo e Inteligencia Climática (`cat_`)

#### Tabla: `cat_categorias`
Clasificación comercial del menú del restaurante.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador autoincremental de la categoría. |
| `nombre` | `VARCHAR(80)` | `NOT NULL` | - | Nombre del grupo (ej: Pastas, Tragos, Postres). |
| `descripcion` | `VARCHAR(255)` | `NULL` | - | Detalle complementario para la carta. |

#### Tabla: `cat_platos`
Información detallada de platos y parámetros climáticos de **SkyPlate**.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador autoincremental del plato. |
| `categoria_id` | `INT UNSIGNED` | `NOT NULL` | `FK` | Enlace a `cat_categorias(id)`. Restricción `RESTRICT`. |
| `nombre` | `VARCHAR(120)` | `NOT NULL` | - | Nombre del plato en la carta. |
| `descripcion` | `TEXT` | `NULL` | - | Ingredientes y descripción comercial visible al cliente. |
| `precio` | `INT UNSIGNED` | `NOT NULL` | - | Precio de venta entero en CLP (sin decimales). |
| `imagen_url` | `VARCHAR(255)` | `NULL` | - | Ruta relativa a la imagen del plato en el frontend. |
| `calorias` | `SMALLINT UNSIGNED` | `NULL` | - | Información nutricional (calorías del plato). |
| `tiempo_min` | `SMALLINT UNSIGNED` | `NULL` | - | Tiempo promedio estimado de cocción (en minutos). |
| `disponible` | `TINYINT(1)` | `NOT NULL` | - | Estado de disponibilidad en cocina (1: Sí, 0: No). |
| `destacado` | `TINYINT(1)` | `NOT NULL` | - | Estado destacado en menú digital (1: Sí, 0: No). |
| `temp_min_recomendar` | `FLOAT` | `NULL` | - | Temperatura mínima ideal para la sugerencia inteligente de IA. |
| `temp_max_recomendar` | `FLOAT` | `NULL` | - | Temperatura máxima ideal para la sugerencia inteligente de IA. |
| `clima_recomendar` | `VARCHAR(50)` | `NULL` | - | Condición climática sugerida (ej. Lluvioso, Soleado). |
| `creado_en` | `TIMESTAMP` | `NOT NULL` | - | Fecha de registro de creación del plato. |
| `actualizado_en` | `TIMESTAMP` | `NOT NULL` | - | Actualización automática de modificaciones mediante el gestor. |

---

### 3.3. Módulo: Bodega y Trazabilidad (`inv_`)

#### Tabla: `inv_insumos`
Lista maestra de ingredientes (materia prima).
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador autoincremental del ingrediente. |
| `nombre` | `VARCHAR(100)` | `NOT NULL` | - | Nombre técnico (ej: Harina 000, Salmón Atlántico). |
| `unidad_medida` | `VARCHAR(20)` | `NOT NULL` | - | Unidad para recetas y bodegaje (`kg`, `lt`, `unidad`, `gramo`). |
| `stock_actual` | `DECIMAL(10,3)`| `NOT NULL` | - | Stock en bodega con precisión de tres decimales para gramos/mililitros. |
| `stock_minimo` | `DECIMAL(10,3)`| `NOT NULL` | - | Umbral mínimo configurado para gatillar el sistema **StockAlert**. |
| `costo_unitario`| `DECIMAL(10,2)`| `NULL` | - | Costo promedio unitario de compra (admite centavos). |
| `creado_en` | `TIMESTAMP` | `NOT NULL` | - | Fecha de registro inicial en bodega. |

#### Tabla: `inv_lotes_insumo`
Trazabilidad de frescura y caducidad para el control FEFO (*First Expired, First Out*).
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador autoincremental del lote de ingreso. |
| `insumo_id` | `INT UNSIGNED` | `NOT NULL` | `FK` | Enlace a `inv_insumos(id)`. Eliminación `CASCADE`. |
| `cantidad` | `DECIMAL(10,3)`| `NOT NULL` | - | Cantidad exacta ingresada en este lote. |
| `fecha_ingreso` | `DATE` | `NOT NULL` | - | Fecha real de llegada del lote de proveedor. |
| `fecha_vencimiento`| `DATE` | `NULL` | - | Fecha de caducidad crítica para auditoría de frescura. |
| `costo_lote` | `DECIMAL(10,2)`| `NULL` | - | Costo financiero total del lote de ingredientes. |
| `proveedor` | `VARCHAR(150)` | `NULL` | - | Razón social o RUT del proveedor del insumo. |

#### Tabla: `inv_recetas`
Tabla asociativa de consumo que vincula un plato con los ingredientes que requiere.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador autoincremental de la receta. |
| `plato_id` | `INT UNSIGNED` | `NOT NULL` | `FK` | Enlace a `cat_platos(id)`. Eliminación `CASCADE`. |
| `insumo_id` | `INT UNSIGNED` | `NOT NULL` | `FK` | Enlace a `inv_insumos(id)`. Regla `ON UPDATE CASCADE`. |
| `cantidad` | `DECIMAL(10,3)`| `NOT NULL` | - | Cantidad exacta consumida de este insumo por cada porción del plato. |

#### Tabla: `inv_alertas_inventario`
Bitácora de fallos o quiebres detectados por el sistema inteligente **StockAlert**.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador autoincremental de la alerta. |
| `insumo_id` | `INT UNSIGNED` | `NOT NULL` | `FK` | Enlace a `inv_insumos(id)`. Eliminación `CASCADE`. |
| `tipo_alerta` | `VARCHAR(50)` | `NOT NULL` | - | Categoría del fallo (`stock_minimo`, `vencimiento`). |
| `mensaje` | `TEXT` | `NULL` | - | Detalle técnico del aviso para el chef. |
| `resuelta` | `TINYINT(1)` | `NOT NULL` | - | Estado de la alerta (1: Solucionada/Repuesta, 0: Activa). |
| `creada_en` | `TIMESTAMP` | `NOT NULL` | - | Fecha y hora exacta de la alerta de inventario. |

---

### 3.4. Módulo: Transacciones de Venta (`ven_`)

#### Tabla: `ven_pedidos`
Cabecera operativa del pedido (creación, control de cocina y estado general).
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador autoincremental de la venta. |
| `usuario_id` | `INT UNSIGNED` | `NULL` | `FK` | Enlace a `auth_usuarios(id)`. Regla `ON DELETE SET NULL`. |
| `total_pedido` | `INT UNSIGNED` | `NOT NULL` | - | Valor bruto total acumulado de la comida (CLP). |
| `estado` | `VARCHAR(50)` | `NOT NULL` | - | Flujo del pedido (`pendiente`, `en_preparacion`, `servido`, `pagado`, `anulado`). |
| `clima_al_pedir` | `VARCHAR(100)` | `NULL` | - | Condición climática en el momento del pedido (para análisis SkyPlate). |
| `temp_al_pedir` | `FLOAT` | `NULL` | - | Temperatura registrada al momento del pedido (para análisis SkyPlate). |
| `creado_en` | `TIMESTAMP` | `NOT NULL` | - | Fecha de inicio del consumo / pedido. |

#### Tabla: `ven_detalle_pedido`
Detalle de artículos por pedido.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED`|`NOT NULL` | `PK` | Identificador autoincremental de alta escala de la línea de detalle. |
| `pedido_id` | `INT UNSIGNED` | `NOT NULL` | `FK` | Enlace a `ven_pedidos(id)`. Eliminación `CASCADE`. |
| `plato_id` | `INT UNSIGNED` | `NOT NULL` | `FK` | Enlace a `cat_platos(id)`. Regla `ON UPDATE CASCADE`. |
| `cantidad` | `INT` | `NOT NULL` | - | Cantidad de porciones solicitadas del plato. |
| `precio_unit` | `INT UNSIGNED` | `NOT NULL` | - | Precio unitario del plato copiado al momento de la venta (CLP). |
| `subtotal` | `INT UNSIGNED` | `NOT NULL` | - | Subtotal calculado (`cantidad * precio_unit`) en CLP. |

#### Tabla: `ven_pagos`
Registro independiente de transacciones financieras para soportar pagos divididos y propinas.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador de pago. |
| `pedido_id` | `INT UNSIGNED` | `NOT NULL` | `FK` | Enlace a `ven_pedidos(id)`. Eliminación `CASCADE`. |
| `metodo_pago` | `VARCHAR(50)` | `NOT NULL` | - | Canal utilizado (`efectivo`, `debito`, `credito`, `transferencia`). |
| `monto_comida` | `INT UNSIGNED` | `NOT NULL` | - | Monto del pedido de comida cubierto por esta transacción (CLP). |
| `monto_propina` | `INT UNSIGNED` | `NOT NULL` | - | Propina del 10% voluntaria agregada al pago (Ley N° 20.729). |
| `monto_redondeo`| `INT` | `NOT NULL` | - | Ajuste positivo o negativo por pago en efectivo (Ley N° 21.010). |
| `total_pagado` | `INT UNSIGNED` | `NOT NULL` | - | Total final transferido (`monto_comida + monto_propina + monto_redondeo`). |
| `creado_en` | `TIMESTAMP` | `NOT NULL` | - | Fecha de emisión de la transacción de pago. |

#### Tabla: `ven_dtes`
Control de Documentos Tributarios Electrónicos oficiales autorizados por el SII.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador único del DTE. |
| `pedido_id` | `INT UNSIGNED` | `NOT NULL` | `FK` | Enlace a `ven_pedidos(id)`. Eliminación `CASCADE`. |
| `tipo_documento`| `ENUM` | `NOT NULL` | - | Tipo oficial ante el SII (`boleta`, `factura`, `nota_credito`). |
| `folio` | `INT UNSIGNED` | `NULL` | - | Folio oficial del DTE emitido por el SII. |
| `rut_receptor` | `VARCHAR(12)` | `NULL` | - | RUT receptor para facturas (formato 12345678-9). |
| `razon_social` | `VARCHAR(150)` | `NULL` | - | Razón social asociada al RUT si es factura. |
| `monto_neto` | `INT UNSIGNED` | `NOT NULL` | - | Subtotal neto sin el impuesto a la venta (CLP). |
| `monto_iva` | `INT UNSIGNED` | `NOT NULL` | - | Impuesto del 19% de IVA (CLP). |
| `monto_ila` | `INT UNSIGNED` | `NOT NULL` | - | Impuestos especiales adicionales (bebidas azucaradas/alcoholes). |
| `monto_exento` | `INT UNSIGNED` | `NOT NULL` | - | Monto del documento no afecto a IVA. |
| `total_dte` | `INT UNSIGNED` | `NOT NULL` | - | Total bruto oficial informado al SII (excluye propinas). |
| `estado_sii` | `VARCHAR(50)` | `NOT NULL` | - | Estado de validación fiscal (`pendiente`, `aceptado`, `rechazado`). |
| `xml_firmado` | `TEXT` | `NULL` | - | Contenido XML firmado digitalmente conforme al SII. |
| `creado_en` | `TIMESTAMP` | `NOT NULL` | - | Fecha oficial de facturación electrónica. |

---

### 3.5. Módulo: Flujos Financieros (`fin_`)

#### Tabla: `fin_categorias_gasto`
Clasificación de egresos operativos para análisis contable.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador autoincremental de la categoría. |
| `nombre` | `VARCHAR(100)` | `NOT NULL` | - | Nombre del grupo de gasto (ej: Arriendos, Proveedores, Sueldos). |

#### Tabla: `fin_gastos`
Control detallado de egresos validados por el sistema inteligente **FinanzIA**.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador autoincremental de la transacción de egreso. |
| `categoria_gasto_id`|`INT UNSIGNED`|`NOT NULL`| `FK` | Enlace a `fin_categorias_gasto(id)`. Regla `ON UPDATE CASCADE`. |
| `registrado_by` | `INT UNSIGNED` | `NULL` | `FK` | Enlace a `auth_usuarios(id)`. Regla `ON DELETE SET NULL`. |
| `descripcion` | `TEXT` | `NULL` | - | Glosa de justificación del gasto. |
| `monto` | `INT UNSIGNED` | `NOT NULL` | - | Valor total del gasto en CLP entero (sin decimales). |
| `fecha` | `DATE` | `NOT NULL` | - | Fecha contable de realización del egreso. |
| `validado_por_ia`| `TINYINT(1)` | `NOT NULL` | - | Estado de auditoría de IA (1: Verificado, 0: Observado/Pendiente). |
| `observacion_ia`| `TEXT` | `NULL` | - | Anotación generada por FinanzIA en caso de discrepancias o alarmas. |
| `creado_en` | `TIMESTAMP` | `NOT NULL` | - | Fecha automática de registro de la transacción. |

#### Tabla: `fin_resumen_diario`
Tabla de consolidación y reportabilidad financiera histórica.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador del resumen diario. |
| `fecha` | `DATE` | `NOT NULL` | `UNIQUE` | Fecha resumida (clave única para evitar duplicidades de cajas). |
| `total_ingresos`| `INT UNSIGNED` | `NOT NULL` | - | Consolidación diaria de pagos de comida recibidos en CLP (netos e impuestos). |
| `total_gastos` | `INT UNSIGNED` | `NOT NULL` | - | Consolidación diaria de los egresos registrados en CLP. |
| `ganancia_neta` | `INT` | `NOT NULL` | - | Resultado contable (`total_ingresos - total_gastos`). Admite signo negativo en caso de pérdida. |
| `num_pedidos` | `INT` | `NOT NULL` | - | Total de boletas/pedidos concretados durante la jornada. |
| `analisis_ia` | `TEXT` | `NULL` | - | Comentarios analíticos y proyecciones de negocio calculadas por FinanzIA. |
| `generado_en` | `TIMESTAMP` | `NOT NULL` | - | Fecha automática de ejecución del cierre de caja contable. |

---

### 3.6. Módulo: Agente Conversacional (`ia_`)

#### Tabla: `ia_consultas_agente`
Bitácora de auditoría y análisis de lenguaje natural a consultas SQL para el asistente **Satoshi**.
| Columna | Tipo | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `NOT NULL` | `PK` | Identificador único de consulta. |
| `usuario_id` | `INT UNSIGNED` | `NOT NULL` | `FK` | Enlace a `auth_usuarios(id)`. Eliminación `CASCADE`. |
| `pregunta_natural`|`TEXT` | `NOT NULL` | - | Texto del usuario en lenguaje natural (ej: "¿Cuáles platos vendieron más con frío?"). |
| `sql_generado` | `TEXT` | `NULL` | - | Sentencia SQL estructurada y ejecutada por el agente conversacional. |
| `respuesta_texto` | `TEXT` | `NULL` | - | Respuesta semántica generada para el usuario corporativo. |
| `exitosa` | `TINYINT(1)` | `NOT NULL` | - | Estado de éxito del flujo (1: Query ejecutó sin fallos, 0: Falló). |
| `creada_en` | `TIMESTAMP` | `NOT NULL` | - | Fecha y hora exacta de realización de la consulta conversacional. |
