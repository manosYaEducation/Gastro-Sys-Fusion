<?php
/**
 * backend/auth_middleware.php
 * Helper de autenticación server-side para páginas PHP protegidas.
 *
 * Uso:
 *   require_once 'backend/auth_middleware.php';
 *   requiere_rol(['gerente', 'administrador']);
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Verifica si hay una sesión activa.
 * @return array|null  Datos del usuario o null si no hay sesión.
 */
function verificar_sesion() {
    if (!empty($_SESSION['usuario_id'])) {
        return [
            'id'     => $_SESSION['usuario_id'],
            'nombre' => $_SESSION['usuario_nombre'],
            'email'  => $_SESSION['usuario_email'],
            'rol'    => $_SESSION['usuario_rol'],
        ];
    }
    return null;
}

/**
 * Requiere que el usuario tenga uno de los roles permitidos.
 * Si no tiene sesión o el rol no es válido, redirige al login.
 *
 * @param array $roles_permitidos  Ej: ['gerente', 'administrador']
 */
function requiere_rol(array $roles_permitidos) {
    $usuario = verificar_sesion();

    if (!$usuario) {
        header('Location: /Gastro-Sys-Fusion/frontend/login.html');
        exit;
    }

    if (!in_array($usuario['rol'], $roles_permitidos)) {
        header('Location: /Gastro-Sys-Fusion/frontend/login.html?error=sin_permiso');
        exit;
    }

    return $usuario;
}
