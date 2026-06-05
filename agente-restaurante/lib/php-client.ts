/**
 * php-client.ts
 * Cliente para consumir el puente de datos seguro en PHP (/api/agente/query.php).
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    generado_en: string;
    query_preview?: string;
  };
  error: string | null;
}

const PHP_API_BASE_URL = process.env.PHP_API_BASE_URL || 'http://localhost/Gastro-Sys-Fusion/api';

/**
 * Ejecuta una consulta SELECT en la base de datos a través del puente PHP.
 *
 * @param sql La consulta SQL (debe empezar con SELECT y estar permitida por la whitelist).
 * @param params Los parámetros para enlazar en la consulta.
 */
export async function queryPHP<T = any>(sql: string, params: any[] = []): Promise<ApiResponse<T>> {
  const url = `${PHP_API_BASE_URL}/agente/query.php`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!res.ok) {
      const text = await res.text();
      let errorMsg = `Error HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(text);
        errorMsg = errJson.error || errorMsg;
      } catch (_) {}
      return {
        success: false,
        data: [],
        meta: { total: 0, generado_en: new Date().toISOString() },
        error: errorMsg,
      };
    }

    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      data: [],
      meta: { total: 0, generado_en: new Date().toISOString() },
      error: err.message || 'Error de conexión con el backend PHP',
    };
  }
}
