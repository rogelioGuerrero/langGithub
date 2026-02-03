-- Schema para gestión de pedidos de clientes
-- Extiende el schema existente del optimizador

-- Tabla de pedidos de clientes
CREATE TABLE IF NOT EXISTS customer_orders (
    id VARCHAR(50) PRIMARY KEY,  -- Formato: ORD-YYYYMMDD-XXXXXXXX
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    address TEXT NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lon DECIMAL(11, 8) NOT NULL,
    package_name VARCHAR(255),
    weight DECIMAL(8, 2) DEFAULT 1.0,  -- kg
    volume DECIMAL(8, 3) DEFAULT 0.1,  -- m³
    delivery_date DATE NOT NULL,
    time_window VARCHAR(20) NOT NULL,  -- Formato: HH:MM-HH:MM
    special_instructions TEXT,
    photos JSONB DEFAULT '[]',  -- Array de base64 images
    status VARCHAR(20) DEFAULT 'pending',
    driver_name VARCHAR(255),
    driver_phone VARCHAR(50),
    estimated_arrival TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_delivery_date ON customer_orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_customer_orders_location ON customer_orders(lat, lon);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created_at ON customer_orders(created_at);

-- Tabla para seguimiento de estados (historial)
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES customer_orders(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    updated_by VARCHAR(100)  -- system, driver, planner, etc.
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_timestamp ON order_status_history(timestamp);

-- Vista para pedidos listos para optimización
CREATE OR REPLACE VIEW orders_ready_for_optimization AS
SELECT 
    co.*,
    CASE 
        WHEN co.delivery_date = CURRENT_DATE THEN 'today'
        WHEN co.delivery_date = CURRENT_DATE + INTERVAL '1 day' THEN 'tomorrow'
        ELSE 'future'
    END as priority_category
FROM customer_orders co
WHERE co.status = 'confirmed'
  AND co.delivery_date >= CURRENT_DATE
ORDER BY co.delivery_date, co.time_window;

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_customer_orders_updated_at
    BEFORE UPDATE ON customer_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para registrar historial de cambios de estado
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (order_id, status, notes, updated_by)
        VALUES (NEW.id, NEW.status, 
                CASE 
                    WHEN OLD.status = 'pending' AND NEW.status = 'confirmed' THEN 'Pedido confirmado'
                    WHEN OLD.status = 'confirmed' AND NEW.status = 'assigned' THEN 'Conductor asignado'
                    WHEN OLD.status = 'assigned' AND NEW.status = 'in_progress' THEN 'En camino'
                    WHEN OLD.status = 'in_progress' AND NEW.status = 'delivered' THEN 'Entregado'
                    WHEN NEW.status = 'cancelled' THEN 'Pedido cancelado'
                    ELSE 'Estado actualizado'
                END,
                'system');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_order_status_change
    BEFORE UPDATE ON customer_orders
    FOR EACH ROW
    EXECUTE FUNCTION log_status_change();

-- Tabla de configuración de ventanas horarias (para validación)
CREATE TABLE IF NOT EXISTS delivery_time_windows (
    id SERIAL PRIMARY KEY,
    window_start TIME NOT NULL,
    window_end TIME NOT NULL,
    max_orders INTEGER DEFAULT 10,  -- Máximo de pedidos en esta ventana
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ventanas horarias por defecto
INSERT INTO delivery_time_windows (window_start, window_end, max_orders) VALUES
('08:00:00', '10:00:00', 8),
('09:00:00', '12:00:00', 12),
('10:00:00', '13:00:00', 10),
('11:00:00', '14:00:00', 10),
('12:00:00', '15:00:00', 8),
('13:00:00', '16:00:00', 10),
('14:00:00', '17:00:00', 8),
('15:00:00', '18:00:00', 10),
('16:00:00', '19:00:00', 8),
('17:00:00', '20:00:00', 6)
ON CONFLICT DO NOTHING;

-- Tabla de conductores
CREATE TABLE IF NOT EXISTS drivers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    vehicle_type VARCHAR(50) NOT NULL,
    license_plate VARCHAR(20),
    max_weight DECIMAL(8, 2),  -- kg
    max_volume DECIMAL(8, 3),  -- m³
    skills JSONB DEFAULT '[]',  -- refrigerado, grande, etc.
    status VARCHAR(20) DEFAULT 'available',  -- available, busy, off_duty
    current_location_lat DECIMAL(10, 8),
    current_location_lon DECIMAL(11, 8),
    last_location_update TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON drivers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Vista de conductores disponibles
CREATE OR REPLACE VIEW available_drivers AS
SELECT 
    d.*,
    CASE 
        WHEN d.last_location_update > NOW() - INTERVAL '30 minutes' THEN 'online'
        WHEN d.last_location_update > NOW() - INTERVAL '2 hours' THEN 'recently_seen'
        ELSE 'offline'
    END as availability_status
FROM drivers d
WHERE d.status = 'available'
  AND d.last_location_update > NOW() - INTERVAL '24 hours';
