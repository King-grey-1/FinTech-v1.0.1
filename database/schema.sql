CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30),
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  country VARCHAR(100),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_records (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  document_type VARCHAR(64),
  document_reference VARCHAR(255),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewer_id UUID,
  rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  available_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  locked_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  transaction_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  transaction_type VARCHAR(32) NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  debit_account VARCHAR(64) NOT NULL,
  credit_account VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'POSTED',
  reference VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investment_products (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  min_investment NUMERIC(18,2) NOT NULL,
  max_investment NUMERIC(18,2),
  duration_days INTEGER NOT NULL,
  expected_return NUMERIC(18,4) NOT NULL,
  performance_fee NUMERIC(18,4) NOT NULL,
  management_fee NUMERIC(18,4) NOT NULL,
  risk_level VARCHAR(16) NOT NULL,
  lock_up_days INTEGER NOT NULL DEFAULT 0,
  withdrawal_rules TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  terms_and_conditions TEXT,
  compliance_status VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investment_positions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID NOT NULL REFERENCES investment_products(id),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  principal_amount NUMERIC(18,2) NOT NULL,
  allocated_amount NUMERIC(18,2) NOT NULL,
  realized_profit NUMERIC(18,2) NOT NULL DEFAULT 0,
  unrealized_profit NUMERIC(18,2) NOT NULL DEFAULT 0,
  fees_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  maturity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trading_accounts (
  account_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  prop_firm_id UUID,
  broker_or_firm VARCHAR(255),
  account_number VARCHAR(255),
  account_type VARCHAR(32) NOT NULL,
  starting_balance NUMERIC(18,2) NOT NULL,
  current_balance NUMERIC(18,2) NOT NULL,
  equity NUMERIC(18,2) NOT NULL,
  drawdown NUMERIC(18,2) NOT NULL DEFAULT 0,
  daily_drawdown NUMERIC(18,2) NOT NULL DEFAULT 0,
  profit NUMERIC(18,2) NOT NULL DEFAULT 0,
  loss NUMERIC(18,2) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  strategy VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prop_firms (
  id UUID PRIMARY KEY,
  prop_firm VARCHAR(255) NOT NULL,
  account_size NUMERIC(18,2) NOT NULL,
  purchase_cost NUMERIC(18,2),
  challenge_status VARCHAR(32) DEFAULT 'PENDING',
  funded_status VARCHAR(32) DEFAULT 'UNFUNDED',
  profit_target NUMERIC(18,2),
  maximum_drawdown NUMERIC(18,2),
  daily_drawdown NUMERIC(18,2),
  consistency_requirements TEXT,
  payout_rules TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(18,2) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  risk_review_status VARCHAR(32) DEFAULT 'PENDING',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewer_id UUID,
  rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  actor_id UUID,
  action VARCHAR(255) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  resource_id VARCHAR(255),
  previous_state JSONB,
  new_state JSONB,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
