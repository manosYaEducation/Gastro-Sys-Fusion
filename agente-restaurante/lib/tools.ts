import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { queryPHP } from './php-client';

// ==========================================
// 1. DECLARACIONES DE HERRAMIENTAS PARA GEMINI
// ==========================================

export const toolsDeclaration: FunctionDeclaration[] = [
  {
    name: 'consultar_ventas',
    description: 'Ventas e ingresos acumulados en un rango de fechas especificado.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        desde: { type: SchemaType.STRING, description: 'Fecha de inicio (YYYY-MM-DD). Ejemplo: 2026-06-01' },
        hasta: { type: SchemaType.STRING, description: 'Fecha de término (YYYY-MM-DD). Ejemplo: 2026-06-05' }
      },
      required: ['desde']
    }
  },
  {
    name: 'consultar_inventario',
    description: 'Stock actual de insumos en bodega, alertas de stock mínimo y costos unitarios.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        solo_alertas: { type: SchemaType.BOOLEAN, description: 'Si es true, sólo retorna insumos con stock por debajo del mínimo.' }
      }
    }
  },
  {
    name: 'consultar_menu',
    description: 'Listado de platos de la carta, precios, disponibilidad y condiciones climáticas recomendadas.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        solo_disponibles: { type: SchemaType.BOOLEAN, description: 'Si es true, filtra solo platos disponibles en cocina.' }
      }
    }
  },
  {
    name: 'consultar_finanzas',
    description: 'Resumen financiero: ingresos, gastos y ganancia neta consolidada.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fecha: { type: SchemaType.STRING, description: 'Fecha específica para el reporte (YYYY-MM-DD). Opcional.' },
        tipo: { 
          type: SchemaType.STRING, 
          description: 'Filtro de visualización.', 
          format: 'enum',
          enum: ['diario', 'mensual', 'gastos_recientes'] 
        }
      }
    }
  },
  {
    name: 'consultar_mermas',
    description: 'Reporte de mermas recientes con desglose de insumo, cantidad, costo y motivo del desperdicio.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        dias: { type: SchemaType.NUMBER, description: 'Cantidad de días hacia atrás para analizar. Por defecto 7.' }
      }
    }
  },
  {
    name: 'consultar_pedidos',
    description: 'Pedidos activos y su estado en cocina (pendiente, en_preparacion, servido, pagado).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        estado: { 
          type: SchemaType.STRING, 
          description: 'Filtrar por estado del pedido.',
          format: 'enum',
          enum: ['pendiente', 'en_preparacion', 'servido', 'pagado'] 
        }
      }
    }
  },
  {
    name: 'reporte_comparativo_mensual',
    description: 'Compara ingresos, gastos y ganancia del mes actual contra el mes anterior. Útil para cierres y análisis gerenciales.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        anio: { type: SchemaType.NUMBER, description: 'Año de análisis (YYYY). Requerido.' },
        mes: { type: SchemaType.NUMBER, description: 'Mes de análisis (1-12). Requerido.' }
      },
      required: ['anio', 'mes']
    }
  }
];

// ==========================================
// 2. LOGICA DE EJECUCION DE CADA HERRAMIENTA
// ==========================================

export async function executeTool(name: string, args: any): Promise<any> {
  console.log(`[Agente IA] Ejecutando herramienta: ${name} con argumentos:`, args);

  switch (name) {
    case 'consultar_ventas': {
      const desde = args.desde;
      const hasta = args.hasta || desde; // Si no hay hasta, asume el mismo día
      
      const sql = `
        SELECT 
          COUNT(id) AS cantidad_pedidos,
          COALESCE(SUM(total_pedido), 0) AS total_ventas,
          COALESCE(AVG(total_pedido), 0) AS ticket_promedio
        FROM ven_pedidos 
        WHERE creado_en >= :desde AND creado_en <= CONCAT(:hasta, ' 23:59:59')
          AND estado != 'anulado'
      `;
      const res = await queryPHP(sql, [
        { name: 'desde', value: desde },
        { name: 'hasta', value: hasta }
      ]);
      return res.success ? res.data[0] : { error: res.error };
    }

    case 'consultar_inventario': {
      const soloAlertas = !!args.solo_alertas;
      let sql = `
        SELECT id, nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario 
        FROM inv_insumos
      `;
      if (soloAlertas) {
        sql += ` WHERE stock_actual <= stock_minimo`;
      }
      const res = await queryPHP(sql);
      return res.success ? res.data : { error: res.error };
    }

    case 'consultar_menu': {
      const soloDisponibles = args.solo_disponibles !== false;
      let sql = `
        SELECT id, nombre, descripcion, precio, disponible, destacado, clima_recomendar 
        FROM cat_platos
      `;
      if (soloDisponibles) {
        sql += ` WHERE disponible = 1`;
      }
      const res = await queryPHP(sql);
      return res.success ? res.data : { error: res.error };
    }

    case 'consultar_finanzas': {
      const fecha = args.fecha;
      const tipo = args.tipo || 'diario';

      if (tipo === 'gastos_recientes') {
        const sql = `
          SELECT g.id, c.nombre AS categoria, g.descripcion, g.monto, g.fecha, g.validado_por_ia
          FROM fin_gastos g
          JOIN fin_categorias_gasto c ON c.id = g.categoria_gasto_id
          ORDER BY g.fecha DESC, g.id DESC
          LIMIT 10
        `;
        const res = await queryPHP(sql);
        return res.success ? res.data : { error: res.error };
      }

      if (fecha) {
        const sql = `
          SELECT fecha, total_ingresos, total_gastos, ganancia_neta, num_pedidos, analisis_ia
          FROM fin_resumen_diario
          WHERE fecha = :fecha
        `;
        const res = await queryPHP(sql, [{ name: 'fecha', value: fecha }]);
        return res.success ? (res.data[0] || { mensaje: 'No hay resumen contable para la fecha especificada.' }) : { error: res.error };
      } else {
        // Reporte acumulado mensual (mes actual)
        const sql = `
          SELECT 
            COALESCE(SUM(total_ingresos), 0) AS total_ingresos,
            COALESCE(SUM(total_gastos), 0) AS total_gastos,
            COALESCE(SUM(ganancia_neta), 0) AS ganancia_neta,
            COALESCE(SUM(num_pedidos), 0) AS total_pedidos
          FROM fin_resumen_diario
          WHERE MONTH(fecha) = MONTH(CURDATE()) AND YEAR(fecha) = YEAR(CURDATE())
        `;
        const res = await queryPHP(sql);
        return res.success ? res.data[0] : { error: res.error };
      }
    }

    case 'consultar_mermas': {
      const dias = args.dias || 7;
      const sql = `
        SELECT 
          m.id, 
          i.nombre AS insumo, 
          m.cantidad, 
          i.unidad_medida, 
          m.motivo, 
          m.fecha,
          COALESCE(m.cantidad * i.costo_unitario, 0) AS costo_estimado_perdida
        FROM mermas m
        JOIN inv_insumos i ON i.id = m.insumo_id
        WHERE m.fecha >= DATE_SUB(CURDATE(), INTERVAL :dias DAY)
        ORDER BY m.fecha DESC
      `;
      const res = await queryPHP(sql, [{ name: 'dias', value: dias }]);
      return res.success ? res.data : { error: res.error };
    }

    case 'consultar_pedidos': {
      const estado = args.estado;
      let sql = `
        SELECT id, total_pedido, estado, creado_en 
        FROM ven_pedidos
      `;
      const params = [];
      if (estado) {
        sql += ` WHERE estado = :estado`;
        params.push({ name: 'estado', value: estado });
      }
      sql += ` ORDER BY creado_en DESC LIMIT 15`;
      
      const res = await queryPHP(sql, params);
      return res.success ? res.data : { error: res.error };
    }

    case 'reporte_comparativo_mensual': {
      const anio = args.anio;
      const mes = args.mes;

      // Calcular mes anterior
      let mesAnt = mes - 1;
      let anioAnt = anio;
      if (mesAnt === 0) {
        mesAnt = 12;
        anioAnt = anio - 1;
      }

      // Consulta mes solicitado
      const sqlMes = `
        SELECT 
          COALESCE(SUM(total_ingresos), 0) AS total_ingresos,
          COALESCE(SUM(total_gastos), 0) AS total_gastos,
          COALESCE(SUM(ganancia_neta), 0) AS ganancia_neta,
          COALESCE(SUM(num_pedidos), 0) AS total_pedidos
        FROM fin_resumen_diario
        WHERE MONTH(fecha) = :mes AND YEAR(fecha) = :anio
      `;

      const [resMes, resMesAnt] = await Promise.all([
        queryPHP(sqlMes, [{ name: 'mes', value: mes }, { name: 'anio', value: anio }]),
        queryPHP(sqlMes, [{ name: 'mes', value: mesAnt }, { name: 'anio', value: anioAnt }])
      ]);

      return {
        mes_solicitado: {
          anio,
          mes,
          datos: resMes.success ? resMes.data[0] : null,
          error: resMes.success ? null : resMes.error
        },
        mes_anterior: {
          anio: anioAnt,
          mes: mesAnt,
          datos: resMesAnt.success ? resMesAnt.data[0] : null,
          error: resMesAnt.success ? null : resMesAnt.error
        }
      };
    }

    default:
      return { error: `La herramienta '${name}' no está implementada.` };
  }
}
