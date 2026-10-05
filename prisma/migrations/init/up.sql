-- Create enum types for MySQL
CREATE TYPE IF NOT EXISTS role_enum AS ENUM ('CLIENT', 'MONTIR', 'ADMIN');
CREATE TYPE IF NOT EXISTS order_status_enum AS ENUM ('REQUESTED', 'MATCHING', 'MECHANIC_ASSIGNED', 'MECHANIC_ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'DIAGNOSING', 'REPAIRING', 'COMPLETED', 'CANCELLED');
CREATE TYPE IF NOT EXISTS payment_status_enum AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');
CREATE TYPE IF NOT EXISTS payment_method_enum AS ENUM ('QRIS', 'GOPAY', 'DANA', 'BANK_TRANSFER');
CREATE TYPE IF NOT EXISTS activity_type_enum AS ENUM ('LOGIN', 'LOGOUT', 'REGISTER', 'CREATE_ORDER', 'ACCEPT_ORDER', 'REJECT_ORDER', 'CANCEL_ORDER', 'COMPLETE_ORDER', 'UPDATE_STATUS', 'ONLINE', 'OFFLINE', 'AI_DIAGNOSIS', 'PAYMENT', 'RATING');

-- users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  full_name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  phone_number VARCHAR(50),
  role role_enum DEFAULT 'CLIENT',
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE,
  phone_number VARCHAR(50),
  address TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id VARCHAR(36) PRIMARY KEY,
  owner_id VARCHAR(36),
  type VARCHAR(50),
  brand VARCHAR(100),
  model VARCHAR(100),
  year INT,
  license_plate VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- mechanic_details table
CREATE TABLE IF NOT EXISTS mechanic_details (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE,
  is_online BOOLEAN DEFAULT FALSE,
  current_lat FLOAT,
  current_lng FLOAT,
  rating FLOAT DEFAULT 5.0,
  total_earnings DECIMAL(12, 2) DEFAULT 0.0,
  specialization VARCHAR(100),
  status VARCHAR(50) DEFAULT 'offline',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- service_requests table
CREATE TABLE IF NOT EXISTS service_requests (
  id VARCHAR(36) PRIMARY KEY,
  client_id VARCHAR(36),
  montir_id VARCHAR(36),
  vehicle_id VARCHAR(36),
  status order_status_enum DEFAULT 'REQUESTED',
  client_lat FLOAT,
  client_lng FLOAT,
  client_address TEXT,
  vehicle_issue_description TEXT,
  symptoms TEXT,
  ai_diagnosis_id VARCHAR(36),
  total_price DECIMAL(12, 2),
  payment_status payment_status_enum DEFAULT 'PENDING',
  payment_method payment_method_enum,
  qr_code VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (montir_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

-- ai_diagnoses table
CREATE TABLE IF NOT EXISTS ai_diagnoses (
  id VARCHAR(36) PRIMARY KEY,
  service_request_id VARCHAR(36) UNIQUE,
  possible_issues JSON,
  symptoms JSON,
  risk_level VARCHAR(50),
  recommended_checks JSON,
  suggested_tools JSON,
  estimated_complexity VARCHAR(50),
  questions_for_client JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE
);

-- service_request_status_history table
CREATE TABLE IF NOT EXISTS service_request_status_history (
  id VARCHAR(36) PRIMARY KEY,
  service_request_id VARCHAR(36),
  previous_status order_status_enum,
  new_status order_status_enum,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by VARCHAR(36),
  FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE
);

-- payments table
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  service_request_id VARCHAR(36) UNIQUE,
  amount DECIMAL(12, 2),
  payment_method payment_method_enum,
  payment_gateway VARCHAR(100),
  transaction_id VARCHAR(255),
  payment_status payment_status_enum DEFAULT 'PENDING',
  qr_code VARCHAR(255),
  paid_at TIMESTAMP,
  expired_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE
);

-- payment_events table
CREATE TABLE IF NOT EXISTS payment_events (
  id VARCHAR(36) PRIMARY KEY,
  payment_id VARCHAR(36),
  event_type VARCHAR(50),
  description TEXT,
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

-- earnings table
CREATE TABLE IF NOT EXISTS earnings (
  id VARCHAR(36) PRIMARY KEY,
  mechanic_id VARCHAR(36),
  service_request_id VARCHAR(36),
  gross_amount DECIMAL(12, 2),
  platform_fee DECIMAL(12, 2) DEFAULT 0.0,
  net_amount DECIMAL(12, 2),
  period VARCHAR(50),
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mechanic_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE SET NULL
);

-- activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  activity_type activity_type_enum,
  description TEXT,
  related_entity VARCHAR(100),
  related_id VARCHAR(36),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  title VARCHAR(255),
  message TEXT,
  type VARCHAR(50),
  related_entity VARCHAR(100),
  related_id VARCHAR(36),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(36) PRIMARY KEY,
  service_request_id VARCHAR(36),
  client_id VARCHAR(36),
  montir_id VARCHAR(36),
  rating INT,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (montir_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id ON vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_details_user_id ON mechanic_details(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_client_id ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_montir_id ON service_requests(montir_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_service_request_id ON ai_diagnoses(service_request_id);
CREATE INDEX IF NOT EXISTS idx_status_history_service_request_id ON service_request_status_history(service_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_service_request_id ON payments(service_request_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_earnings_mechanic_id ON earnings(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_service_request_id ON reviews(service_request_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews(client_id);