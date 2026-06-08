<?php
/**
 * api/clientes.php — T1.6 / US-1.5
 *
 * GET  ?email=X            → Busca cliente por email
 * GET  ?telefono=X         → Busca cliente por teléfono
 * GET  ?id=X&historial=1   → Historial de pedidos del cliente
 * POST { action:"upsert", nombre, email?, telefono? }
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();
require_once __DIR__ . '/../backend/conexion.php';

$method = $_SERVER['REQUEST_METHOD'];

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {

    // Historial de pedidos del cliente
    if (!empty($_GET['id']) && !empty($_GET['historial'])) {
        $cid = (int) $_GET['id'];
        try {
            // Verificar que el cliente existe
            $sc = $conn->prepare("SELECT id,nombre,email,telefono,creado_en FROM clientes WHERE id=:id");
            $sc->execute([':id' => $cid]);
            $cliente = $sc->fetch();
            if (!$cliente) {
                http_response_code(404);
                echo json_encode(['success'=>false,'error'=>'Cliente no encontrado']);
                exit;
            }

            // Verificar si la columna cliente_id existe en ven_pedidos
            $colCheck = $conn->query("SHOW COLUMNS FROM ven_pedidos LIKE 'cliente_id'");
            if (!$colCheck->fetch()) {
                // La columna no existe: intentar crearla
                $conn->exec("ALTER TABLE ven_pedidos ADD COLUMN cliente_id INT UNSIGNED DEFAULT NULL AFTER usuario_id");
            }

            // Obtener pedidos del cliente
            $sp = $conn->prepare("
                SELECT id, total_pedido, estado, creado_en
                FROM ven_pedidos
                WHERE cliente_id = :cid
                ORDER BY creado_en DESC
                LIMIT 50
            ");
            $sp->execute([':cid' => $cid]);
            $pedidos = $sp->fetchAll();

            // Obtener detalle de cada pedido
            $sd = $conn->prepare("
                SELECT d.plato_id,
                       p.nombre AS plato_nombre,
                       d.cantidad,
                       d.precio_unit,
                       d.subtotal
                FROM ven_detalle_pedido d
                JOIN cat_platos p ON p.id = d.plato_id
                WHERE d.pedido_id = :pid
            ");
            foreach ($pedidos as &$pedido) {
                $sd->execute([':pid' => $pedido['id']]);
                $pedido['items'] = $sd->fetchAll();
            }
            unset($pedido);

            echo json_encode([
                'success' => true,
                'data'    => ['cliente' => $cliente, 'pedidos' => $pedidos],
                'meta'    => ['total_pedidos' => count($pedidos), 'generado_en' => date('c')],
                'error'   => null,
            ]);
        } catch (\PDOException $e) {
            http_response_code(500);
            echo json_encode(['success'=>false,'error'=>'Error de BD: '.$e->getMessage()]);
        }
        exit;
    }

    // Búsqueda por email o teléfono
    $email    = trim($_GET['email']    ?? '');
    $telefono = trim($_GET['telefono'] ?? '');
    if (!$email && !$telefono) {
        http_response_code(400);
        echo json_encode(['success'=>false,'error'=>'Se requiere ?email= o ?telefono=']);
        exit;
    }
    try {
        if ($email) {
            $s = $conn->prepare("SELECT id,nombre,email,telefono,creado_en FROM clientes WHERE email=:v");
            $s->execute([':v' => $email]);
        } else {
            $s = $conn->prepare("SELECT id,nombre,email,telefono,creado_en FROM clientes WHERE telefono=:v");
            $s->execute([':v' => $telefono]);
        }
        $cliente = $s->fetch();
        if (!$cliente) { echo json_encode(['success'=>false,'error'=>'Cliente no encontrado','data'=>null]); exit; }
        echo json_encode(['success'=>true,'data'=>$cliente,'meta'=>['generado_en'=>date('c')],'error'=>null]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success'=>false,'error'=>'Error de BD: '.$e->getMessage()]);
    }
    exit;
}

// ── POST — upsert ────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $input    = json_decode(file_get_contents('php://input'), true);
    $action   = $input['action']   ?? '';
    $nombre   = trim($input['nombre']   ?? '');
    $email    = trim($input['email']    ?? '') ?: null;
    $telefono = trim($input['telefono'] ?? '') ?: null;

    if ($action !== 'upsert') {
        http_response_code(400);
        echo json_encode(['success'=>false,'error'=>'Acción no soportada. Use: upsert']);
        exit;
    }
    if (!$email && !$telefono) {
        http_response_code(400);
        echo json_encode(['success'=>false,'error'=>'Se requiere al menos email o teléfono.']);
        exit;
    }
    try {
        $existing = null;
        if ($email) {
            $s = $conn->prepare("SELECT id FROM clientes WHERE email=:v");
            $s->execute([':v' => $email]);
            $existing = $s->fetchColumn();
        }
        if (!$existing && $telefono) {
            $s = $conn->prepare("SELECT id FROM clientes WHERE telefono=:v");
            $s->execute([':v' => $telefono]);
            $existing = $s->fetchColumn();
        }

        if ($existing) {
            if ($nombre) {
                $conn->prepare("UPDATE clientes SET nombre=:n WHERE id=:id")->execute([':n'=>$nombre,':id'=>$existing]);
            }
            $clienteId = (int) $existing;
            $isNew = false;
        } else {
            $conn->prepare("INSERT INTO clientes (nombre,email,telefono) VALUES (:n,:e,:t)")
                 ->execute([':n'=>$nombre ?: 'Cliente',':e'=>$email,':t'=>$telefono]);
            $clienteId = (int) $conn->lastInsertId();
            $isNew = true;
        }

        $sf = $conn->prepare("SELECT id,nombre,email,telefono,creado_en FROM clientes WHERE id=:id");
        $sf->execute([':id' => $clienteId]);
        $cliente = $sf->fetch();

        http_response_code($isNew ? 201 : 200);
        echo json_encode([
            'success' => true, 'data' => $cliente,
            'meta'    => ['creado' => $isNew, 'generado_en' => date('c')],
            'error'   => null,
            'message' => $isNew ? 'Cliente registrado.' : 'Cliente identificado.',
        ]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success'=>false,'error'=>'Error de BD: '.$e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success'=>false,'error'=>'Method Not Allowed']);
