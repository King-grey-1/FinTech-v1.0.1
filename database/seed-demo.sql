INSERT INTO users (id, email, phone, password_hash, first_name, last_name, date_of_birth, country, status, email_verified, mfa_enabled)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin@example.local', '+10000000001', '$argon2id$v=19$m=65536,t=3,p=4$demo$admin', 'System', 'Admin', '1990-01-01', 'US', 'ACTIVE', true, true),
  ('22222222-2222-4222-8222-222222222222', 'user1@example.local', '+10000000002', '$argon2id$v=19$m=65536,t=3,p=4$demo$user1', 'Alice', 'Investor', '1992-02-02', 'US', 'ACTIVE', true, false),
  ('33333333-3333-4333-8333-333333333333', 'user2@example.local', '+10000000003', '$argon2id$v=19$m=65536,t=3,p=4$demo$user2', 'Bob', 'Trader', '1988-03-03', 'GB', 'ACTIVE', true, false)
ON CONFLICT (email) DO NOTHING;

INSERT INTO wallets (id, user_id, currency, available_balance, locked_balance, pending_balance)
VALUES
  ('aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'USD', 50000.00, 0.00, 0.00),
  ('bbbb1111-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'USD', 12000.00, 0.00, 0.00),
  ('cccc1111-cccc-4ccc-8ccc-cccccccccccc', '33333333-3333-4333-8333-333333333333', 'USD', 18000.00, 0.00, 0.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO investment_products (id, name, min_investment, max_investment, duration_days, expected_return, performance_fee, management_fee, risk_level, lock_up_days, withdrawal_rules, status, terms_and_conditions, compliance_status)
VALUES
  ('pppp1111-pppp-4ppp-8ppp-pppppppppppp', 'Trading Strategy A', 100.00, 50000.00, 14, 8.50, 10.00, 1.50, 'HIGH', 7, 'Target return only; subject to strategy risk and market conditions.', 'ACTIVE', 'Target return language only. No guaranteed return. Review legal/compliance before live money.', 'REVIEWED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO audit_logs (id, actor_id, action, resource, resource_id, previous_state, new_state, ip_address, user_agent)
VALUES
  ('audit-1111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'SEED_DEMO', 'SYSTEM', 'seed', '{"status":"init"}', '{"status":"ready"}', '127.0.0.1', 'demo-seed')
ON CONFLICT (id) DO NOTHING;
