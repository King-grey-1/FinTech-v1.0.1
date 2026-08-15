# FinTech Platform v1.0.1

A comprehensive, production-ready financial technology platform built with TypeScript, Express.js, and PostgreSQL. Featuring robust withdrawal processing, risk assessment, compliance audit trails, and payment provider integration.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Building](#building)
- [Database Setup](#database-setup)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Features

### Core Financial Operations
- **Withdrawal Management** - Complete lifecycle from request through settlement
- **Risk Assessment** - Automated risk evaluation with configurable thresholds
- **Approval Workflow** - Multi-stage approval process with admin review
- **Settlement Processing** - Integration with payment providers for fund transfers

### Compliance & Security
- **Audit Logging** - Complete compliance trail for all withdrawal operations
- **RBAC (Role-Based Access Control)** - Fine-grained permission management
- **Idempotency** - Prevent duplicate withdrawal processing
- **Rate Limiting** - User and account-level withdrawal limits with persistent history

### Payment Integration
- **Webhook Reconciliation** - Handles payment provider status updates
- **Payment Provider Abstraction** - Pluggable payment processor interface
- **Transaction Mapping** - Tracks provider transaction IDs across system

### Trading & Investment
- **Portfolio Management** - Track user holdings and allocations
- **Trading Engine** - Execute buy/sell operations with performance metrics
- **Financial Calculations** - ROI, XIRR, and portfolio analysis

## Architecture

### Monorepo Structure (TypeScript)

```
FinTech-v1.0.1/
├── packages/
│   ├── @platform/types              # Shared TypeScript types and contracts
│   ├── @platform/financial-engine   # Core financial calculations and logic
│   ├── @platform/api                # Express.js backend API
│   └── @platform/web                # Next.js frontend (React)
├── tests/
│   └── unit/                        # Vitest unit test suite (93 tests)
├── apps/
│   ├── api/                         # Main API application
│   │   ├── src/
│   │   │   ├── lib/                 # Business logic and repositories
│   │   │   ├── routes/              # API endpoints
│   │   │   ├── middleware/          # Express middleware
│   │   │   └── main.ts              # Application entry point
│   │   └── package.json
│   └── web/                         # Next.js frontend
└── package.json
```

### Database Layer

**PostgreSQL with 4 Core Tables:**

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `withdrawal_requests` | Withdrawal state and metadata | UUID PK, status/risk indexes |
| `withdrawal_history` | Rate limiting history | User/timestamp indexes, TTL cleanup |
| `audit_logs` | Compliance audit trail | JSONB metadata, event/time indexes |
| `idempotency_keys` | Duplicate prevention | Auto-expiration, status tracking |

Connection pooling with 20 max connections, 30s idle timeout, automatic reconnection.

## Project Structure

```
apps/api/src/
├── lib/
│   ├── database.ts                 # PostgreSQL connection pool singleton
│   ├── withdrawal-repository.ts    # CRUD for withdrawals
│   ├── audit-log-repository.ts     # Audit trail persistence
│   ├── rate-limiting-repository.ts # Rate limit history
│   ├── idempotency-repository.ts   # Idempotency tracking
│   ├── db-init.ts                  # Schema initialization
│   ├── withdrawal-flow.ts          # Withdrawal state machine
│   ├── approval-workflow.ts        # Admin approval logic
│   ├── settlement-finalization.ts  # Payment provider integration
│   ├── audit-log.ts                # Audit event logging
│   ├── rate-limiting.ts            # Rate limit enforcement
│   ├── idempotency.ts              # Idempotency cache
│   ├── rbac.ts                     # Role-based access control
│   ├── payment-provider.ts         # Payment provider interface
│   ├── webhook-handler.ts          # Webhook reconciliation
│   └── api-response.ts             # Standard response format
├── middleware/
│   ├── auth.ts                     # Authentication middleware
│   └── error-handler.ts            # Global error handling
├── routes/
│   ├── admin-withdrawals.ts        # Admin approval endpoints
│   ├── withdrawals.ts              # User withdrawal endpoints
│   ├── trading.ts                  # Trading endpoints
│   └── health.ts                   # Health check endpoint
└── main.ts                         # Application startup

tests/unit/
├── withdrawal-flow.spec.ts         # State machine tests
├── approval-workflow.spec.ts       # Approval logic tests
├── settlement-finalization.spec.ts # Settlement tests
├── audit-log.spec.ts               # Audit logging tests
├── rate-limiting.spec.ts           # Rate limit tests
├── idempotency.spec.ts             # Idempotency tests
├── rbac.spec.ts                    # RBAC tests
├── webhook-handler.spec.ts         # Webhook processing tests
└── ...
```

## Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **npm**: v9+ or yarn
- **PostgreSQL**: v12+ (local or remote)
- **Git**: For version control

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd FinTech-v1.0.1
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install workspace dependencies:**
   ```bash
   npm run install:all
   ```

## Configuration

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=fintech
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=your_secure_password

# API Configuration
API_PORT=3001
NODE_ENV=development

# Payment Provider
DEMO_PAYMENT_PROVIDER_ENABLED=true
```

### Database Initialization

The database schema is automatically created on application startup. The `initializeDatabase()` function runs:

1. Creates `withdrawal_requests` table with withdrawal state and metadata
2. Creates `withdrawal_history` table for rate limiting
3. Creates `audit_logs` table for compliance tracking
4. Creates `idempotency_keys` table for duplicate prevention

Each table includes appropriate indexes for query performance.

## Development

### Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3001`

### Start with Watch Mode

```bash
npm run dev:watch
```

Automatically rebuilds on file changes.

## Testing

### Run All Tests

```bash
npm run test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Specific Test File

```bash
npx vitest run tests/unit/withdrawal-flow.spec.ts
```

### Test Coverage

```bash
npm run test:coverage
```

**Current Status**: 93 tests passing
- Withdrawal flow (3 tests)
- Approval workflow (6 tests)
- Settlement processing (4 tests)
- Audit logging (5 tests)
- Rate limiting (6 tests)
- Idempotency (4 tests)
- RBAC (3 tests)
- Webhook handling (7 tests)
- Financial engine (various tests)
- Trading performance (various tests)

## Building

### TypeScript Compilation

```bash
npm run build
```

Compiles all packages in strict mode with no errors or warnings.

### Build Next.js Frontend

```bash
npm run build:web
```

### Full Production Build

```bash
npm run build:all
```

## Database Setup

### Local PostgreSQL Setup (macOS with Homebrew)

```bash
# Install PostgreSQL
brew install postgresql

# Start PostgreSQL service
brew services start postgresql

# Create database
createdb fintech

# Create user
psql fintech -c "CREATE USER postgres WITH PASSWORD 'password';"
psql fintech -c "ALTER USER postgres WITH SUPERUSER;"
```

### Docker Setup

```bash
docker run -d \
  --name postgres-fintech \
  -e POSTGRES_DB=fintech \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15
```

### Verify Connection

```bash
psql -h localhost -U postgres -d fintech -c "SELECT version();"
```

## API Endpoints

### User Withdrawal Endpoints

**Request Withdrawal**
```
POST /api/withdrawals/request
Content-Type: application/json

{
  "userId": "user-123",
  "amount": "500.00",
  "currency": "USD",
  "bankAccountDetails": "account-1234",
  "idempotencyKey": "unique-key-123"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "withdrawal": {
      "id": "wdr-xyz",
      "userId": "user-123",
      "amount": "500.00",
      "status": "REQUESTED",
      "riskLevel": "LOW",
      "timestamp": "2026-08-15T18:32:00Z"
    }
  }
}
```

### Admin Endpoints (Requires MANAGE_PLATFORM Permission)

**Approve/Reject Withdrawal**
```
POST /api/admin/withdrawals/approve
Content-Type: application/json

{
  "withdrawalId": "wdr-xyz",
  "decision": "APPROVED",
  "reason": "Verified user account"
}

Response: 200 OK
```

**Settle Withdrawal**
```
POST /api/admin/withdrawals/settle
Content-Type: application/json

{
  "withdrawalId": "wdr-xyz"
}

Response: 200 OK
```

**List Pending Withdrawals**
```
GET /api/admin/withdrawals/pending

Response: 200 OK
{
  "success": true,
  "data": {
    "withdrawals": [...]
  }
}
```

**Get Audit Trail**
```
GET /api/admin/audit/withdrawal/{withdrawalId}
GET /api/admin/audit/user/{userId}

Response: 200 OK
{
  "success": true,
  "data": {
    "auditEntries": [
      {
        "eventType": "WITHDRAWAL_REQUESTED",
        "action": "User initiated withdrawal",
        "timestamp": "2026-08-15T18:32:00Z"
      }
    ]
  }
}
```

### Trading Endpoints

**Execute Trade**
```
POST /api/trading/execute
Content-Type: application/json

{
  "userId": "user-123",
  "portfolioId": "port-456",
  "operation": "BUY",
  "symbol": "AAPL",
  "quantity": 10,
  "limitPrice": "150.00"
}
```

**Get Portfolio**
```
GET /api/trading/portfolio/{portfolioId}
```

**Get Performance Metrics**
```
GET /api/trading/performance/{portfolioId}
```

### Health Check

```
GET /api/health

Response: 200 OK
{
  "status": "healthy",
  "timestamp": "2026-08-15T18:32:00Z"
}
```

## Deployment

### Prerequisites for Deployment

1. ✅ All tests passing (93/93)
2. ✅ TypeScript compilation clean
3. ✅ PostgreSQL database configured
4. ✅ Environment variables set
5. ✅ SSL certificates configured (for production)

### Environment Setup

```bash
# Production environment
NODE_ENV=production
POSTGRES_HOST=prod-db.example.com
POSTGRES_PORT=5432
POSTGRES_DATABASE=fintech_prod
POSTGRES_USERNAME=prod_user
POSTGRES_PASSWORD=<secure_password>

# API Configuration
API_PORT=80 (or 443 for HTTPS)

# Payment Provider
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Deployment Steps

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Initialize database schema:**
   ```bash
   npm run migrate
   ```

3. **Start the API server:**
   ```bash
   npm run start
   ```

4. **Verify health:**
   ```bash
   curl https://api.example.com/api/health
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY dist ./dist

EXPOSE 3001

CMD ["node", "dist/apps/api/src/main.js"]
```

```bash
# Build image
docker build -t fintech:v1.0.1 .

# Run container
docker run -d \
  -e POSTGRES_HOST=db-host \
  -e POSTGRES_PASSWORD=password \
  -p 3001:3001 \
  fintech:v1.0.1
```

## Contributing

### Development Workflow

1. Create a feature branch: `git checkout -b feature/withdrawal-limits`
2. Make changes following code style
3. Run tests: `npm run test`
4. Commit: `git commit -m "feat: add withdrawal limits"`
5. Push: `git push origin feature/withdrawal-limits`
6. Create pull request

### Code Style

- **TypeScript**: Strict mode, no implicit any
- **Formatting**: Prettier configured
- **Linting**: ESLint with recommended config
- **Testing**: Vitest with comprehensive unit tests

### Adding a New Feature

1. **Add types** in `packages/@platform/types/src/index.ts`
2. **Implement business logic** in appropriate `lib/` module
3. **Add repository layer** if database persistence needed
4. **Create API routes** in `apps/api/src/routes/`
5. **Write unit tests** in `tests/unit/`
6. **Update this README** with new endpoints

## Troubleshooting

### Database Connection Issues

**Problem**: `Error: Database pool not initialized`
- **Solution**: Ensure `POSTGRES_HOST`, `POSTGRES_PASSWORD` are set correctly
- Run: `psql -h $POSTGRES_HOST -U postgres -d $POSTGRES_DATABASE -c "SELECT 1"`

### Test Failures

**Problem**: Async audit log errors
- **Solution**: All database calls are now async with fallback to in-memory storage
- Tests automatically handle database unavailability with in-memory cache

### Port Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3001`
- **Solution**: Change API_PORT or kill process: `lsof -i :3001 | kill -9 <PID>`

## Performance Optimization

### Database Query Optimization

- All withdrawal and audit queries use indexed columns
- Batch operations for rate limiting
- Connection pooling with 20 concurrent connections
- Prepared statements prevent SQL injection

### Caching Strategy

- In-memory audit log cache for fast local access
- Withdrawal history cached by user ID
- Idempotency results cached with auto-expiration
- Fallback to database on cache miss

## Security Considerations

- ✅ RBAC with permission-based access control
- ✅ SQL injection prevention via parameterized queries
- ✅ Audit logging for all sensitive operations
- ✅ Idempotency keys prevent replay attacks
- ✅ Rate limiting prevents abuse
- ✅ Withdrawal state machine prevents invalid transitions

## License

Proprietary - FinTech Platform v1.0.1

## Support

For issues and questions:
1. Check troubleshooting section
2. Review test cases for usage examples
3. Check GitHub issues
4. Contact development team

---

**Last Updated**: August 15, 2026
**Status**: Production Ready
**Test Coverage**: 93 tests passing (100%)