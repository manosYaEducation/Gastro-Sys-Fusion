# 2. Diagrama Entidad-Relación (ERD) mediante Mermaid

Este documento contiene la visualización gráfica de la arquitectura de la base de datos de **Gastro-Sys-Fusion**, modelando las relaciones físicas y lógicas adaptadas al mercado de Chile.

---

```mermaid
erDiagram
    auth_roles ||--o{ auth_usuarios : "tiene"
    cat_categorias ||--o{ cat_platos : "clasifica"
    cat_platos ||--o{ inv_recetas : "usa"
    inv_insumos ||--o{ inv_recetas : "compone"
    inv_insumos ||--o{ inv_lotes_insumo : "rastrea"
    inv_insumos ||--o{ inv_alertas_inventario : "dispara"
    auth_usuarios |o--o{ ven_pedidos : "realiza"
    ven_pedidos ||--o{ ven_detalle_pedido : "contiene"
    cat_platos ||--o{ ven_detalle_pedido : "se_vende_en"
    ven_pedidos ||--o{ ven_pagos : "se_paga_con"
    ven_pedidos ||--o{ ven_dtes : "genera"
    fin_categorias_gasto ||--o{ fin_gastos : "clasifica"
    auth_usuarios |o--o{ fin_gastos : "registra"
    auth_usuarios ||--o{ ia_consultas_agente : "consulta"

    auth_roles {
        int id PK
        varchar nombre
        text descripcion
    }

    auth_usuarios {
        int id PK
        int rol_id FK
        varchar nombre
        varchar email
        varchar password_hash
        timestamp creado_en
    }

    cat_categorias {
        int id PK
        varchar nombre
        varchar descripcion
    }

    cat_platos {
        int id PK
        int categoria_id FK
        varchar nombre
        text descripcion
        int precio
        varchar imagen_url
        smallint calorias
        smallint tiempo_min
        tinyint disponible
        tinyint destacado
        float temp_min_recomendar
        float temp_max_recomendar
        varchar clima_recomendar
        timestamp creado_en
        timestamp actualizado_en
    }

    inv_insumos {
        int id PK
        varchar nombre
        varchar unidad_medida
        decimal stock_actual
        decimal stock_minimo
        decimal costo_unitario
        timestamp creado_en
    }

    inv_lotes_insumo {
        int id PK
        int insumo_id FK
        decimal cantidad
        date fecha_ingreso
        date fecha_vencimiento
        decimal costo_lote
        varchar proveedor
    }

    inv_recetas {
        int id PK
        int plato_id FK
        int insumo_id FK
        decimal cantidad
    }

    inv_alertas_inventario {
        int id PK
        int insumo_id FK
        varchar tipo_alerta
        text mensaje
        tinyint resuelta
        timestamp creada_en
    }

    ven_pedidos {
        int id PK
        int usuario_id FK
        int total_pedido
        varchar estado
        varchar clima_al_pedir
        float temp_al_pedir
        timestamp creado_en
    }

    ven_detalle_pedido {
        bigint id PK
        int pedido_id FK
        int plato_id FK
        int cantidad
        int precio_unit
        int subtotal
    }

    ven_pagos {
        int id PK
        int pedido_id FK
        varchar metodo_pago
        int monto_comida
        int monto_propina
        int monto_redondeo
        int total_pagado
        timestamp creado_en
    }

    ven_dtes {
        int id PK
        int pedido_id FK
        enum tipo_documento
        int folio
        varchar rut_receptor
        varchar razon_social
        int monto_neto
        int monto_iva
        int monto_ila
        int monto_exento
        int total_dte
        varchar estado_sii
        text xml_firmado
        timestamp creado_en
    }

    fin_categorias_gasto {
        int id PK
        varchar nombre
    }

    fin_gastos {
        int id PK
        int categoria_gasto_id FK
        int registrado_by FK
        text descripcion
        int monto
        date fecha
        tinyint validado_por_ia
        text observacion_ia
        timestamp creado_en
    }

    fin_resumen_diario {
        int id PK
        date fecha
        int total_ingresos
        int total_gastos
        int ganancia_neta
        int num_pedidos
        text analisis_ia
        timestamp generado_en
    }

    ia_consultas_agente {
        int id PK
        int usuario_id FK
        text pregunta_natural
        text sql_generado
        text respuesta_texto
        tinyint exitosa
        timestamp creada_en
    }
```
