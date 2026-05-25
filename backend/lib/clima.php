<?php
/**
 * lib/clima.php
 * Módulo de integración con OpenWeatherMap + motor de reglas de recomendación.
 *
 * Uso:
 *   require_once __DIR__ . '/clima.php';
 *   $clima = obtenerClimaActual();
 *   // $clima['temperatura'], $clima['condicion'], $clima['descripcion'], …
 *
 * Motor de reglas (condicion → etiqueta interna):
 *   lluvia (Rain/Drizzle/Thunderstorm/Snow) → 'lluvia'
 *   temp < 15                               → 'frio'
 *   temp > 25                               → 'sol'
 *   else                                    → 'templado'
 */

/**
 * Punto de entrada principal.
 * Intenta OpenWeatherMap; si falla, usa estimación estacional.
 */
function obtenerClimaActual(): array
{
    $apiKey = $_ENV['OPENWEATHERMAP_API_KEY'] ?? '';
    $ciudad = $_ENV['CIUDAD_RESTAURANTE']     ?? 'Santiago,CL';

    if (!$apiKey || $apiKey === 'tu_api_key_aqui') {
        return _climaFallback();
    }

    $url = sprintf(
        'https://api.openweathermap.org/data/2.5/weather?q=%s&appid=%s&units=metric&lang=es',
        urlencode($ciudad),
        $apiKey
    );

    $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
    $raw = @file_get_contents($url, false, $ctx);

    if ($raw === false) {
        return _climaFallback();
    }

    $data = json_decode($raw, true);

    if (!isset($data['main']['temp'])) {
        return _climaFallback();
    }

    $temp         = (float) $data['main']['temp'];
    $condRaw      = $data['weather'][0]['main']        ?? 'Clear';
    $descripcion  = $data['weather'][0]['description'] ?? 'despejado';
    $condicion    = _mapearCondicion($temp, $condRaw);

    return [
        'temperatura'   => round($temp, 1),
        'condicion'     => $condicion,          // 'lluvia' | 'frio' | 'sol' | 'templado'
        'condicion_raw' => $condRaw,            // valor original de OWM
        'descripcion'   => ucfirst($descripcion),
        'ciudad'        => $ciudad,
        'fuente'        => 'openweathermap',
        'icono_owm'     => $data['weather'][0]['icon'] ?? null,
        'humedad'       => $data['main']['humidity']   ?? null,
        'sensacion'     => round($data['main']['feels_like'] ?? $temp, 1),
    ];
}

/**
 * Motor de reglas: temperatura + condición OWM → etiqueta interna.
 *
 * Prioridad: lluvia tiene precedencia sobre temperatura.
 *
 * Contrato del agente (valores de condicion):
 *   lluvia | frio | sol | templado
 */
function _mapearCondicion(float $temp, string $condRaw): string
{
    $condRaw = strtolower(trim($condRaw));

    // Lluvia tiene prioridad (incluyendo nieve → comfort food)
    if (in_array($condRaw, ['rain', 'drizzle', 'thunderstorm', 'snow'], true)) {
        return 'lluvia';
    }

    if ($temp < 15) return 'frio';
    if ($temp > 25) return 'sol';

    return 'templado';
}

/**
 * Fallback estacional basado en el hemisferio sur (Chile).
 * Se activa cuando no hay API key o la solicitud a OWM falla.
 */
function _climaFallback(): array
{
    $month = (int) date('n'); // 1-12

    // Hemisferio sur: verano dic-feb, invierno jun-ago
    if ($month >= 12 || $month <= 2) {
        $temp      = 28.0;
        $condicion = 'sol';
        $desc      = 'Verano (estimado)';
    } elseif ($month >= 6 && $month <= 8) {
        $temp      = 10.0;
        $condicion = 'frio';
        $desc      = 'Invierno (estimado)';
    } else {
        $temp      = 18.0;
        $condicion = 'templado';
        $desc      = 'Clima templado (estimado)';
    }

    return [
        'temperatura'   => $temp,
        'condicion'     => $condicion,
        'condicion_raw' => 'Fallback',
        'descripcion'   => $desc,
        'ciudad'        => 'Santiago, CL',
        'fuente'        => 'fallback',
        'icono_owm'     => null,
        'humedad'       => null,
        'sensacion'     => $temp,
    ];
}

/**
 * Mapea la condicion del contrato de API ('lluvia'|'sol'|'frio'|'templado')
 * al/los valores usados en la columna clima_recomendar de cat_platos.
 *
 * cat_platos.clima_recomendar usa: 'lluvioso','calido','frio','templado','todos'
 *
 * @return string[]  Lista de etiquetas de BD que aplican para esa condición.
 */
function condicionATagsDB(string $condicion): array
{
    return match ($condicion) {
        'lluvia'   => ['lluvioso', 'todos'],
        'frio'     => ['frio',     'todos'],
        'sol'      => ['calido',   'todos'],
        'templado' => ['templado', 'calido', 'todos'],
        default    => ['todos'],
    };
}
