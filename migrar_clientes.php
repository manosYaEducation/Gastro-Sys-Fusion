<?php
/**
 * migrar_clientes.php — Ejecuta la migración T1.6 una sola vez.
 * Accede desde el navegador: http://localhost/Gastro-Sys-Fusion/migrar_clientes.php
 * O desde CLI: php migrar_clientes.php
 */

require_once __DIR__ . '/vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$env  = $_ENV['ENVIRONMENT'] ?? 'production';
$host = $env === 'production' ? $_ENV['PROD_DB_HOST'] : $_ENV['DEV_DB_HOST'];
$port = $env === 'production' ? $_ENV['PROD_DB_PORT'] : $_ENV['DEV_DB_PORT'];
$user = $env === 'production' ? $_ENV['PROD_DB_USER'] : $_ENV['DEV_DB_USER'];
$pass = $env === 'production' ? $_ENV['PROD_DB_PASSWORD'] : $_ENV['DEV_DB_PASSWORD'];
$db   = $env === 'production' ? $_ENV['PROD_DB_NAME'] : $_ENV['DEV_DB_NAME'];

try {
    $pdo = new PDO(
        "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4",
        $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    die("❌ Conexión fallida: " . $e->getMessage() . PHP_EOL);
}

$isCli = (php_sapi_name() === 'cli');
if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
}

$statements = [
    // 1. Tabla clientes
    "CREATE TABLE IF NOT EXISTS clientes (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre      VARCHAR(120) NOT NULL DEFAULT '',
        email       VARCHAR(180)          DEFAULT NULL,
        telefono    VARCHAR(30)           DEFAULT NULL,
        creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actualizado DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_email    (email),
        UNIQUE KEY uq_telefono (telefono)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    // 2. Columna cliente_id en ven_pedidos
    "ALTER TABLE ven_pedidos ADD COLUMN IF NOT EXISTS cliente_id INT UNSIGNED DEFAULT NULL AFTER usuario_id",

    // 3. Foreign key (puede fallar si ya existe — ignoramos)
    "ALTER TABLE ven_pedidos ADD CONSTRAINT fk_pedido_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL ON UPDATE CASCADE",

    // 4. Índice de búsqueda rápida
    "CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON ven_pedidos(cliente_id)",

    // 5. Datos de prueba
    "INSERT IGNORE INTO clientes (nombre, email, telefono) VALUES
        ('María González',   'maria.gonzalez@ejemplo.cl', '+56912345678'),
        ('Carlos Rodríguez', 'carlos.rod@ejemplo.cl',     '+56987654321'),
        ('Ana Martínez',     'ana.martinez@ejemplo.cl',   NULL)",
];

echo "=== Migración T1.6 — Tabla clientes ===" . PHP_EOL . PHP_EOL;

foreach ($statements as $sql) {
    $preview = substr(trim(preg_replace('/\s+/', ' ', $sql)), 0, 70);
    try {
        $pdo->exec($sql);
        echo "  ✅ OK  → $preview..." . PHP_EOL;
    } catch (PDOException $e) {
        // Duplicados de FK/índice son normales si se vuelve a ejecutar
        $msg = $e->getMessage();
        $skip = (strpos($msg, 'Duplicate key name') !== false ||
                 strpos($msg, 'already exists') !== false ||
                 strpos($msg, 'errno: 121') !== false ||
                 strpos($msg, 'errno: 176') !== false);
        if ($skip) {
            echo "  ⚠️  SKIP → Ya existe: $preview..." . PHP_EOL;
        } else {
            echo "  ❌ ERR  → $preview..." . PHP_EOL;
            echo "           " . $msg . PHP_EOL;
        }
    }
}

echo PHP_EOL . "=== Migración completada ===" . PHP_EOL;
