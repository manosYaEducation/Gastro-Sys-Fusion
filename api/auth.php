<?php
/**
 * api/auth.php
 * Endpoint de autenticación para Gastro-Sys-Fusion.
 *
 * POST action=login   → Iniciar sesión
 * POST action=logout  → Cerrar sesión
 * GET  action=check   → Verificar sesión activa
 */

header('Content-Type: application/json; charset=utf-8');

// CORS: permitir credenciales (cookies de sesión) — wildcard '*' no funciona con credentials
$origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost';
$allowed_origins = [
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:80',
];
if (in_array($origin, $allowed_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: http://localhost');
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../backend/conexion.php';

// Configurar sesión antes de iniciarla (necesario para que las cookies funcionen
// correctamente con fetch credentials:'include' en localhost)
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'domain'   => '',
    'secure'   => false,   // false en localhost (sin HTTPS)
    'httponly' => true,
    'samesite' => 'Lax',   // Lax permite peticiones same-site con fetch
]);
session_start();

// Determinar la acción
$action = $_GET['action'] ?? $_POST['action'] ?? null;

// Si es POST con JSON body, decodificar
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($_POST)) {
    $json = json_decode(file_get_contents('php://input'), true);
    if ($json) {
        $action   = $json['action']   ?? $action;
        $email    = $json['email']    ?? null;
        $password = $json['password'] ?? null;
    }
} else {
    $email    = $_POST['email']    ?? null;
    $password = $_POST['password'] ?? null;
}

/**
 * Respuesta estándar del proyecto
 */
function responder($success, $data = [], $error = null, $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'data'    => $data,
        'meta'    => [
            'total'       => is_array($data) ? count($data) : 0,
            'generado_en' => date('c'),
        ],
        'error' => $error,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Rutas ──────────────────────────────────────────────

switch ($action) {

    // ═══════════════════════════════════════
    // LOGIN
    // ═══════════════════════════════════════
    case 'login':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            responder(false, [], 'Método no permitido', 405);
        }

        if (empty($email) || empty($password)) {
            responder(false, [], 'Email y contraseña son requeridos', 400);
        }

        // Buscar usuario por email
        $stmt = $conn->prepare("
            SELECT id, nombre, email, password_hash, rol, activo
            FROM usuarios
            WHERE email = :email
            LIMIT 1
        ");
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user) {
            responder(false, [], 'Credenciales incorrectas', 401);
        }

        if (!$user['activo']) {
            responder(false, [], 'Tu cuenta ha sido desactivada. Contacta al administrador.', 403);
        }

        // Verificar contraseña
        if (!password_verify($password, $user['password_hash'])) {
            responder(false, [], 'Credenciales incorrectas', 401);
        }

        // Actualizar último login
        $stmt2 = $conn->prepare("UPDATE usuarios SET ultimo_login = NOW() WHERE id = :id");
        $stmt2->execute([':id' => $user['id']]);

        // Crear sesión
        $_SESSION['usuario_id']     = $user['id'];
        $_SESSION['usuario_nombre'] = $user['nombre'];
        $_SESSION['usuario_email']  = $user['email'];
        $_SESSION['usuario_rol']    = $user['rol'];

        responder(true, [
            'id'     => $user['id'],
            'nombre' => $user['nombre'],
            'email'  => $user['email'],
            'rol'    => $user['rol'],
        ]);
        break;

    // ═══════════════════════════════════════
    // LOGOUT
    // ═══════════════════════════════════════
    case 'logout':
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $p['path'], $p['domain'], $p['secure'], $p['httponly']
            );
        }
        session_destroy();
        responder(true, [], null);
        break;

    // ═══════════════════════════════════════
    // CHECK (verificar sesión activa)
    // ═══════════════════════════════════════
    case 'check':
        if (!empty($_SESSION['usuario_id'])) {
            responder(true, [
                'id'     => $_SESSION['usuario_id'],
                'nombre' => $_SESSION['usuario_nombre'],
                'email'  => $_SESSION['usuario_email'],
                'rol'    => $_SESSION['usuario_rol'],
            ]);
        } else {
            responder(false, [], 'No hay sesión activa', 401);
        }
        break;

    default:
        responder(false, [], 'Acción no válida. Usa: login, logout, check', 400);
        break;
}
