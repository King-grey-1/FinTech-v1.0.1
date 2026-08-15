# STEP 2 — DATABASE ERD

## Core entities and relationships

```mermaid
erDiagram
    USERS ||--o{ KYC : has
    USERS ||--o| WALLET : owns
    USERS ||--o{ LEDGER_TRANSACTION : records
    USERS ||--o{ INVESTMENT : makes
    USERS ||--o{ WITHDRAWAL_REQUEST : requests
    USERS ||--o{ PAYMENT_TRANSACTION : initiates
    USERS ||--o{ NOTIFICATION : receives
    USERS ||--o{ LOGIN_SESSION : has
    USERS ||--o{ RISK_EVENT : triggers
    USERS ||--o{ AUDIT_LOG : acts_on

    WALLET ||--o{ LEDGER_TRANSACTION : affected_by
    INVESTMENT_PRODUCT ||--o{ INVESTMENT : offers
    INVESTMENT ||--o{ INVESTMENT_PERFORMANCE : tracks
    TRADING_ACCOUNT ||--o{ TRADING_PERFORMANCE : produces
    PROP_FIRM ||--o{ TRADING_ACCOUNT : manages
    INVESTMENT ||--o{ WITHDRAWAL_REQUEST : settles

    USERS {
      uuid id PK
      string email
      string phone
      string password_hash
      string first_name
      string last_name
      date date_of_birth
      string country
      string status
      boolean email_verified
      boolean mfa_enabled
      datetime created_at
      datetime updated_at
    }

    KYC {
      uuid id PK
      uuid user_id FK
      string verification_status
      string document_type
      string document_reference
      datetime submitted_at
      datetime reviewed_at
      uuid reviewer_id FK
      string rejection_reason
    }

    WALLET {
      uuid id PK
      uuid user_id FK
      string currency
      decimal available_balance
      decimal locked_balance
      decimal pending_balance
      datetime created_at
    }

    LEDGER_TRANSACTION {
      uuid transaction_id PK
      uuid user_id FK
      uuid wallet_id FK
      string transaction_type
      decimal amount
      string currency
      string debit_account
      string credit_account
      string status
      string reference
      string description
      datetime created_at
    }

    INVESTMENT_PRODUCT {
      uuid id PK
      string name
      decimal min_investment
      decimal max_investment
      integer investment_duration_days
      decimal expected_return
      decimal performance_fee
      decimal management_fee
      string risk_level
      integer lock_up_days
      string withdrawal_rules
      string status
      text terms_and_conditions
      string compliance_status
      datetime created_at
      datetime updated_at
    }

    INVESTMENT {
      uuid id PK
      uuid user_id FK
      uuid product_id FK
      uuid wallet_id FK
      decimal principal_amount
      decimal allocated_amount
      decimal realized_profit
      decimal unrealized_profit
      decimal fees_paid
      string status
      datetime start_at
      datetime maturity_at
      datetime created_at
      datetime updated_at
    }

    TRADING_ACCOUNT {
      uuid account_id PK
      uuid user_id FK
      uuid prop_firm_id FK
      string broker_or_firm
      string account_number
      string account_type
      decimal starting_balance
      decimal current_balance
      decimal equity
      decimal drawdown
      decimal daily_drawdown
      decimal profit
      decimal loss
      string status
      string strategy
      datetime created_at
    }

    PROP_FIRM {
      uuid id PK
      string prop_firm
      decimal account_size
      decimal purchase_cost
      string challenge_status
      string funded_status
      decimal profit_target
      decimal maximum_drawdown
      decimal daily_drawdown
      string consistency_requirements
      string payout_rules
      string status
      datetime created_at
    }

    TRADING_PERFORMANCE {
      uuid id PK
      uuid account_id FK
      decimal daily_pnl
      decimal weekly_pnl
      decimal monthly_pnl
      decimal total_pnl
      decimal roi
      decimal win_rate
      decimal average_win
      decimal average_loss
      decimal max_drawdown
      decimal sharpe_ratio
      decimal profit_factor
      text equity_curve_json
      datetime recorded_at
      uuid imported_by FK
      string source_type
    }

    WITHDRAWAL_REQUEST {
      uuid id PK
      uuid user_id FK
      decimal amount
      string currency
      string status
      string idempotency_key
      string risk_review_status
      datetime requested_at
      datetime reviewed_at
      uuid reviewer_id FK
      string rejection_reason
    }

    PAYMENT_TRANSACTION {
      uuid id PK
      uuid user_id FK
      string internal_txn_id
      string provider_txn_id
      decimal amount
      string currency
      string status
      string payment_method
      string verification_status
      datetime created_at
    }

    NOTIFICATION {
      uuid id PK
      uuid user_id FK
      string channel
      string template_key
      string subject
      text body
      boolean read_at
      datetime created_at
    }

    AUDIT_LOG {
      uuid id PK
      uuid actor_id FK
      string action
      string resource
      string resource_id
      json previous_state
      json new_state
      string ip_address
      string user_agent
      datetime created_at
    }
```

## Key design principles

- Financial data is append-only and auditable
- Wallet balances are not edited directly; they are derived from ledger entries
- Trading/account performance data is either imported or manually recorded, but every correction creates a new audit record
- KYC documents are stored through secure object storage or encrypted vault references, not as free-form sensitive data in the main database
- Withdrawal requests enforce lock checks, idempotency, and state-machine validation
