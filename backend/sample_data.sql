-- Insertar datos de prueba para customer_orders
-- Ejecutar en Neon PostgreSQL

INSERT INTO customer_orders (
    id, customer_name, customer_phone, customer_email, address, 
    lat, lon, package_name, weight, volume, delivery_date, time_window,
    special_instructions, status
) VALUES 
-- Pedidos para hoy (pendientes)
('ORD-20260203-0001', 'Ana García', '11-2345-6789', 'ana@email.com', 
 'Av. Corrientes 1500, Buenos Aires', -34.6037, -58.3816, 
 'Caja pequeña', 2.5, 0.05, '2026-02-03', '09:00-12:00', 
 'Entregar en recepción', 'pending'),

('ORD-20260203-0002', 'Carlos López', '11-3456-7890', 'carlos@email.com', 
 'Santa Fe 1200, Buenos Aires', -34.5895, -58.3951, 
 'Documento importante', 0.5, 0.01, '2026-02-03', '10:00-13:00', 
 'Llamar antes de llegar', 'pending'),

('ORD-20260203-0003', 'María Rodríguez', '11-4567-8901', 'maria@email.com', 
 'Córdoba 800, Buenos Aires', -34.6012, -58.3837, 
 'Paquete mediano', 5.0, 0.15, '2026-02-03', '14:00-17:00', 
 '', 'pending'),

-- Pedidos para mañana
('ORD-20260204-0001', 'Juan Pérez', '11-5678-9012', 'juan@email.com', 
 'Belgrano 1500, Buenos Aires', -34.6085, -58.3765, 
 'Caja grande', 10.0, 0.30, '2026-02-04', '08:00-11:00', 
 'Consignatario: Sr. González', 'confirmed'),

('ORD-20260204-0002', 'Laura Martínez', '11-6789-0123', 'laura@email.com', 
 'Callao 1200, Buenos Aires', -34.5937, -58.3989, 
 'Sobre', 0.2, 0.001, '2026-02-04', '11:00-14:00', 
 'Entrega urgente', 'confirmed'),

-- Pedidos en progreso
('ORD-20260202-0001', 'Roberto Sánchez', '11-7890-1234', 'roberto@email.com', 
 '9 de Julio 500, Buenos Aires', -34.6035, -58.3818, 
 'Electrónico frágil', 3.0, 0.08, '2026-02-02', '15:00-18:00', 
 'Manejar con cuidado', 'in_progress'),

-- Pedidos entregados
('ORD-20260202-0002', 'Sofía Díaz', '11-8901-2345', 'sofia@email.com', 
 'Rivadavia 3000, Buenos Aires', -34.6105, -58.3950, 
 'Libros', 7.5, 0.20, '2026-02-02', '10:00-13:00', 
 '', 'delivered'),

-- Pedidos cancelados
('ORD-20260202-0003', 'Miguel Ángel', '11-9012-3456', 'miguel@email.com', 
 'Pueyrredón 1800, Buenos Aires', -34.6045, -58.3955, 
 'Ropa', 4.0, 0.12, '2026-02-02', '14:00-17:00', 
 'Cliente canceló', 'cancelled')

ON CONFLICT (id) DO NOTHING;

-- Insertar conductores de ejemplo
INSERT INTO drivers (
    id, name, phone, email, vehicle_type, license_plate, 
    max_weight, max_volume, skills, status,
    current_location_lat, current_location_lon, last_location_update
) VALUES 
('DRV-001', 'Pedro Gómez', '11-1111-1111', 'pedro@delivery.com', 
 'Van', 'ABC123', 800, 2.5, 
 '["refrigerado", "grande"]', 'available', 
 -34.6037, -58.3816, NOW()),

('DRV-002', 'Diego Fernández', '11-2222-2222', 'diego@delivery.com', 
 'Camión', 'XYZ789', 4000, 15.0, 
 '["grande", "maquinaria"]', 'busy', 
 -34.5895, -58.3951, NOW() - INTERVAL '15 minutes'),

('DRV-003', 'Laura Castro', '11-3333-3333', 'laura@delivery.com', 
 'Moto', 'DEF456', 50, 0.1, 
 '["rapido", "pequeño"]', 'available', 
 -34.6012, -58.3837, NOW() - INTERVAL '5 minutes')

ON CONFLICT (id) DO NOTHING;
