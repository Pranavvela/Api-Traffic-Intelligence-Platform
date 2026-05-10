-- Seed a legacy registered API (user_id = NULL) so simulators using any user can claim it
INSERT INTO registered_apis (user_id, endpoint, method, threshold, is_active, api_type, validation_status)
VALUES (NULL, '/simulator/test', 'POST', 100, true, 'INTERNAL', 'PENDING');

-- You can run this with psql:
-- psql -d api_traffic_db -U postgres -f server/scripts/seed_registered_apis.sql
