-- Down migration - drop all tables (reverse order due to foreign keys)
DROP INDEX IF EXISTS idx_reviews_client_id;
DROP INDEX IF EXISTS idx_reviews_service_request_id;
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_activity_logs_user_id;
DROP INDEX IF EXISTS idx_earnings_mechanic_id;
DROP INDEX IF EXISTS idx_payment_events_payment_id;
DROP INDEX IF EXISTS idx_payments_service_request_id;
DROP INDEX IF EXISTS idx_status_history_service_request_id;
DROP INDEX IF EXISTS idx_ai_diagnoses_service_request_id;
DROP INDEX IF EXISTS idx_service_requests_status;
DROP INDEX IF EXISTS idx_service_requests_montir_id;
DROP INDEX IF EXISTS idx_service_requests_client_id;
DROP INDEX IF EXISTS idx_profiles_user_id;
DROP INDEX IF EXISTS idx_users_email;

DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS earnings;
DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS service_request_status_history;
DROP TABLE IF EXISTS ai_diagnoses;
DROP TABLE IF EXISTS service_requests;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS mechanic_details;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS role_enum;
DROP TYPE IF EXISTS order_status_enum;
DROP TYPE IF EXISTS payment_status_enum;
DROP TYPE IF EXISTS payment_method_enum;
DROP TYPE IF EXISTS activity_type_enum;