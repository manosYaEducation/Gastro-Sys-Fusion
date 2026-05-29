<?php
/**
 * setup_usuarios.php
 * Crea la tabla de usuarios y pobla con 4 usuarios de prueba.
 * Ejecutar UNA sola vez vía navegador: http://localhost/Gastro-Sys-Fusion/setup_usuarios.php
 */

require 'backend/conexion.php';

try {
    // ── Crear tabla de usuarios ──
    $conn->exec("
        CREATE TABLE IF NOT EXISTS usuarios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            rol ENUM('cliente', 'jefe_cocina', 'administrador', 'gerente') NOT NULL DEFAULT 'cliente',
            activo TINYINT(1) DEFAULT 1,
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
            ultimo_login DATETIME NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "✅ Tabla 'usuarios' creada (o ya existía).<br>";

    // ── Insertar usuarios de prueba ──
    $usuarios = [
        [
            'nombre'   => 'Admin Sistema',
            'email'    => 'admin@gastro.cl',
            'password' => 'admin123',
            'rol'      => 'administrador',
        ],
        [
            'nombre'   => 'Chef Carlos',
            'email'    => 'chef@gastro.cl',
            'password' => 'cocina123',
            'rol'      => 'jefe_cocina',
        ],
        [
            'nombre'   => 'Gerente María',
            'email'    => 'gerente@gastro.cl',
            'password' => 'gerente123',
            'rol'      => 'gerente',
        ],
        [
            'nombre'   => 'Cliente Demo',
            'email'    => 'cliente@gastro.cl',
            'password' => 'cliente123',
            'rol'      => 'cliente',
        ],
    ];

    $stmt = $conn->prepare("
        INSERT INTO usuarios (nombre, email, password_hash, rol)
        VALUES (:nombre, :email, :password_hash, :rol)
        ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)
    ");

    foreach ($usuarios as $u) {
        $stmt->execute([
            ':nombre'        => $u['nombre'],
            ':email'         => $u['email'],
            ':password_hash' => password_hash($u['password'], PASSWORD_DEFAULT),
            ':rol'           => $u['rol'],
        ]);
        echo "👤 Usuario '{$u['nombre']}' ({$u['email']}) — Rol: {$u['rol']}<br>";
    }

    echo "<br>🎉 Setup completado. Ya puedes iniciar sesión.";

} catch (PDOException $e) {
    echo "❌ Error: " . $e->getMessage();
}
