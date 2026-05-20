# Documentación de Arquitectura de Base de Datos: Gastro-Sys-Fusion

## 1. Visión General del Sistema
El sistema **Gastro-Sys-Fusion** unifica múltiples dominios de negocio gastronómico (Menú, Bodega, Ventas, Finanzas e Inteligencia Artificial) en una sola base de datos relacional para el mercado de la República de Chile.

Para equilibrar la agilidad de desarrollo en PHP con la robustez y la velocidad del software, el motor MySQL (InnoDB) se estructura bajo una estrategia de **Monolito Modular con Prefijos Lógicos**. Cada módulo del código fuente interactúa exclusivamente con las tablas correspondientes a su dominio mediante su prefijo asignado, impidiendo acoplamientos fuertes en el código PHP.

### Adaptación Contable y Tributaria Chilena (SII / DTE / Propina / Redondeo)
El modelo de datos está especialmente adaptado a las regulaciones vigentes en Chile:
1. **Precisión CLP (Peso Chileno):** Todos los valores monetarios de venta, pago y gasto se manejan como enteros (`INT`), eliminando los decimales que no existen en la moneda física ni digital en Chile.
2. **Separación de Responsabilidades Contables:** Se separa el concepto operativo del **Pedido** (`ven_pedidos`), la transacción física de los **Pagos** (`ven_pagos` que soporta cuentas divididas, Ley N° 20.729 de propina del 10% y Ley N° 21.010 de redondeo en efectivo) y el documento oficial legal o **DTE** (`ven_dtes` para boletas y facturas enviadas al SII).

---

## 🗂️ Índice de la Documentación
Para facilitar la navegación y modularidad del proyecto, la documentación técnica del modelo de datos ha sido dividida en secciones especializadas. Selecciona una sección para ver más detalles:

* 📊 **[2. Diagrama Entidad-Relación (ERD) mediante Mermaid](./diagrama-entidad-relacion.md)**
  * *Visualización gráfica interactiva del modelo físico-lógico y las relaciones cardinales entre las 16 tablas del sistema.*
* 📖 **[3. Diccionario de Datos Técnico Detallado](./diccionario-datos.md)**
  * *Definición exhaustiva columna por columna de todas las tablas de Usuarios, Catálogo, Bodega, Ventas, DTEs, Pagos, Finanzas y el Agente Conversacional.*
* ⚙️ **[4. Guía Operativa para Desarrolladores PHP](./guia-operativa.md)**
  * *Directrices operacionales para programadores en PHP: flujos transaccionales de venta en Chile, emisión DTE en SII, redondeo de caja, resguardo contable y buenas prácticas de seguridad.*