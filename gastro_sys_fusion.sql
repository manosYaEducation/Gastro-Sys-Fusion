-- ============================================================
-- Gastro-Sys-Fusion — Base de Datos Unificada para MySQL
-- Listo para phpMyAdmin
-- ============================================================

CREATE DATABASE IF NOT EXISTS `gastro_sys_fusion`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `gastro_sys_fusion`;

-- ------------------------------------------------------------
-- 1. MÓDULO: USUARIOS Y ROLES (Prefijo: auth_)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `auth_roles` (
  `id`          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `nombre`      VARCHAR(50)      NOT NULL COMMENT 'cliente, jefe_cocina, administrador, gerente',
  `descripcion` TEXT                 NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auth_usuarios` (
  `id`            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `rol_id`        INT UNSIGNED     NOT NULL,
  `nombre`        VARCHAR(100)     NOT NULL,
  `apellido`        VARCHAR(100)     NOT NULL,
  `email`         VARCHAR(150)     NOT NULL UNIQUE,
  `password_hash` VARCHAR(255)     NOT NULL,
  `creado_en`     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_usuarios_rol`
    FOREIGN KEY (`rol_id`) REFERENCES `auth_roles` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. MÓDULO: CATÁLOGO (Prefijo: cat_) - SkyPlate + DIcreme
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cat_categorias` (
  `id`          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `nombre`      VARCHAR(80)      NOT NULL COMMENT 'Pastas, Pescados, Bebidas...',
  `descripcion` VARCHAR(255)         NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cat_platos` (
  `id`                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `categoria_id`        INT UNSIGNED     NOT NULL,
  `nombre`              VARCHAR(120)     NOT NULL,
  `descripcion`         TEXT                 NULL,
  `precio`              INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Precio de venta en CLP',
  `imagen_url`          VARCHAR(255)         NULL COMMENT 'Ruta relativa a assets/img/',
  `calorias`            SMALLINT UNSIGNED    NULL,
  `tiempo_min`          SMALLINT UNSIGNED    NULL COMMENT 'Tiempo de preparación en minutos',
  `disponible`          TINYINT(1)       NOT NULL DEFAULT 1,
  `destacado`           TINYINT(1)       NOT NULL DEFAULT 0,
  -- Atributos de Inteligencia Climática (SkyPlate)
  `temp_min_recomendar` FLOAT                NULL COMMENT 'Temp. mínima para recomendación IA',
  `temp_max_recomendar` FLOAT                NULL COMMENT 'Temp. máxima para recomendación IA',
  `clima_recomendar`    VARCHAR(50)          NULL COMMENT 'Condición climática idónea',
  `creado_en`           TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_platos_categoria`
    FOREIGN KEY (`categoria_id`) REFERENCES `cat_categorias` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. MÓDULO: INVENTARIO (Prefijo: inv_) - StockAlert
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inv_insumos` (
  `id`             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `nombre`         VARCHAR(100)     NOT NULL,
  `unidad_medida`  VARCHAR(20)      NOT NULL COMMENT 'kg, lt, unidad, gramo',
  `stock_actual`   DECIMAL(10,3)    NOT NULL DEFAULT 0.000,
  `stock_minimo`   DECIMAL(10,3)    NOT NULL COMMENT 'Umbral para alertas',
  `costo_unitario` DECIMAL(10,2)        NULL,
  `creado_en`      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inv_lotes_insumo` (
  `id`                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `insumo_id`         INT UNSIGNED     NOT NULL,
  `cantidad`          DECIMAL(10,3)    NOT NULL,
  `fecha_ingreso`     DATE             NOT NULL,
  `fecha_vencimiento` DATE                 NULL COMMENT 'Alertas caducidad',
  `costo_lote`        DECIMAL(10,2)        NULL,
  `proveedor`         VARCHAR(150)         NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_lotes_insumo`
    FOREIGN KEY (`insumo_id`) REFERENCES `inv_insumos` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inv_recetas` (
  `id`        INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `plato_id`  INT UNSIGNED     NOT NULL,
  `insumo_id` INT UNSIGNED     NOT NULL,
  `cantidad`  DECIMAL(10,3)    NOT NULL COMMENT 'Insumo por porción',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_recetas_plato`
    FOREIGN KEY (`plato_id`) REFERENCES `cat_platos` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_recetas_insumo`
    FOREIGN KEY (`insumo_id`) REFERENCES `inv_insumos` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inv_alertas_inventario` (
  `id`          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `insumo_id`   INT UNSIGNED     NOT NULL,
  `tipo_alerta` VARCHAR(50)      NOT NULL COMMENT 'stock_minimo, vencimiento',
  `mensaje`     TEXT                 NULL,
  `resuelta`    TINYINT(1)       NOT NULL DEFAULT 0,
  `creada_en`   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_alertas_insumo`
    FOREIGN KEY (`insumo_id`) REFERENCES `inv_insumos` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. MÓDULO: VENTAS (Prefijo: ven_) - DIcreme
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ven_pedidos` (
  `id`             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `usuario_id`     INT UNSIGNED         NULL COMMENT 'NULL si es invitado',
  `total_pedido`   INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Total de la comida en CLP (Entero)',
  `estado`         VARCHAR(50)      NOT NULL COMMENT 'pendiente, en_preparacion, servido, pagado, anulado',
  `clima_al_pedir` VARCHAR(100)         NULL COMMENT 'Análisis SkyPlate',
  `temp_al_pedir`  FLOAT                NULL COMMENT 'Análisis SkyPlate',
  `creado_en`      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_pedidos_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `auth_usuarios` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NOTA: Aquí usamos BIGINT para evitar que se quede sin espacio en el futuro remoto
CREATE TABLE IF NOT EXISTS `ven_detalle_pedido` (
  `id`          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `pedido_id`   INT UNSIGNED     NOT NULL,
  `plato_id`    INT UNSIGNED     NOT NULL,
  `cantidad`    INT              NOT NULL,
  `precio_unit` INT UNSIGNED     NOT NULL COMMENT 'Precio unitario en CLP (Entero)',
  `subtotal`    INT UNSIGNED     NOT NULL COMMENT 'Precio unitario * cantidad',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_detalle_pedido`
    FOREIGN KEY (`pedido_id`) REFERENCES `ven_pedidos` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_detalle_plato`
    FOREIGN KEY (`plato_id`) REFERENCES `cat_platos` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NUEVA TABLA: REGISTRO DE PAGOS Y TRANSACCIONES (Cuentas divididas y leyes propina/redondeo)
CREATE TABLE IF NOT EXISTS `ven_pagos` (
  `id`             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `pedido_id`      INT UNSIGNED     NOT NULL,
  `metodo_pago`    VARCHAR(50)      NOT NULL COMMENT 'efectivo, debito, credito, transferencia',
  `monto_comida`   INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Parte de la cuenta de comida que cubre',
  `monto_propina`  INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Propina del 10% (Ley N° 20.729)',
  `monto_redondeo` INT              NOT NULL DEFAULT 0 COMMENT 'Redondeo por pago en efectivo (Ley N° 21.010)',
  `total_pagado`   INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '(monto_comida + monto_propina + monto_redondeo)',
  `creado_en`      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_pagos_pedido`
    FOREIGN KEY (`pedido_id`) REFERENCES `ven_pedidos` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NUEVA TABLA: DOCUMENTOS TRIBUTARIOS ELECTRÓNICOS (DTE - Integración con SII)
CREATE TABLE IF NOT EXISTS `ven_dtes` (
  `id`             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `pedido_id`      INT UNSIGNED     NOT NULL,
  `tipo_documento` ENUM('boleta', 'factura', 'nota_credito') NOT NULL DEFAULT 'boleta',
  `folio`          INT UNSIGNED         NULL COMMENT 'Folio oficial asignado por el SII',
  `rut_receptor`   VARCHAR(12)          NULL COMMENT 'RUT para Factura DTE (ej: 12345678-9)',
  `razon_social`   VARCHAR(150)         NULL COMMENT 'Razón social del receptor si es factura',
  `monto_neto`     INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Monto neto sin IVA',
  `monto_iva`      INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '19% de IVA',
  `monto_ila`      INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Impuesto Adicional a Alcohol/Bebidas',
  `monto_exento`   INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Monto exento de IVA',
  `total_dte`      INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Total tributable del documento',
  `estado_sii`     VARCHAR(50)      NOT NULL DEFAULT 'pendiente' COMMENT 'pendiente, aceptado, rechazado',
  `xml_firmado`    TEXT                 NULL COMMENT 'XML DTE firmado digitalmente',
  `creado_en`      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_dtes_pedido`
    FOREIGN KEY (`pedido_id`) REFERENCES `ven_pedidos` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. MÓDULO: FINANZAS (Prefijo: fin_) - FinanzIA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fin_categorias_gasto` (
  `id`     INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100)     NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fin_gastos` (
  `id`                 INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `categoria_gasto_id` INT UNSIGNED     NOT NULL,
  `registrado_by`      INT UNSIGNED         NULL,
  `descripcion`         TEXT                 NULL,
  `monto`              INT UNSIGNED     NOT NULL COMMENT 'Monto en CLP (Entero)',
  `fecha`              DATE             NOT NULL,
  `validado_por_ia`    TINYINT(1)       NOT NULL DEFAULT 0,
  `observacion_ia`     TEXT                 NULL,
  `creado_en`          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_gastos_categoria`
    FOREIGN KEY (`categoria_gasto_id`) REFERENCES `fin_categorias_gasto` (`id`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_gastos_usuario`
    FOREIGN KEY (`registrado_by`) REFERENCES `auth_usuarios` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fin_resumen_diario` (
  `id`             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `fecha`          DATE             NOT NULL UNIQUE,
  `total_ingresos` INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Total de ingresos en CLP (Entero)',
  `total_gastos`   INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Total de gastos en CLP (Entero)',
  `ganancia_neta`  INT              NOT NULL DEFAULT 0 COMMENT 'Ganancia neta en CLP (Puede ser negativa)',
  `num_pedidos`    INT              NOT NULL DEFAULT 0,
  `analisis_ia`    TEXT                 NULL,
  `generado_en`    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 6. MÓDULO: AGENTE IA (Prefijo: ia_) - Satoshi / Michael
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ia_consultas_agente` (
  `id`               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `usuario_id`       INT UNSIGNED     NOT NULL,
  `pregunta_natural` TEXT             NOT NULL,
  `sql_generado`     TEXT                 NULL,
  `respuesta_texto`  TEXT                 NULL,
  `exitosa`          TINYINT(1)       NOT NULL DEFAULT 0,
  `creada_en`        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_consultas_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `auth_usuarios` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- DATOS INICIALES (SEED COMPATIBLE CON MYSQL)
-- ============================================================

INSERT INTO `auth_roles` (`nombre`, `descripcion`) VALUES
  ('administrador', 'Acceso total al sistema'),
  ('jefe_cocina',   'Gestor de recetas, platos e inventario'),
  ('gerente',       'Visualización de finanzas y reportes de IA'),
  ('cliente',       'Comensales de la plataforma e-commerce');

INSERT INTO `cat_categorias` (`nombre`, `descripcion`) VALUES
  ('Pastas',   'Pastas frescas artesanales de inspiración italiana'),
  ('Pescados', 'Selección de pescados y mariscos del día');

INSERT INTO `cat_platos`
  (`categoria_id`, `nombre`, `descripcion`, `precio`, `imagen_url`, `calorias`, `tiempo_min`, `disponible`, `destacado`, `temp_min_recomendar`, `temp_max_recomendar`, `clima_recomendar`)
VALUES
  (
    1, 'Tagliatelle al Ragù Bolognese',
    'Pasta fresca artesanal con ragù de ternera cocinado a fuego lento durante 6 horas, terminada con parmesano DOP y albahaca fresca.',
    16900, 'plato_pasta.png', 680, 25, 1, 1, 5.0, 18.0, 'Lluvioso o Frío'
  ),
  (
    2, 'Salmón a la Plancha con Mantequilla de Limón',
    'Filete de salmón atlántico sellado a alta temperatura, bañado en mantequilla clarificada con limón y alcaparras, acompañado de vegetales asados y microgreens de rúcula.',
    21500, 'plato_salmon.png', 520, 18, 1, 1, 15.0, 32.0, 'Soleado'
  );