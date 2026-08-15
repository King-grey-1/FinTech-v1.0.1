# STEP 3 — PROJECT STRUCTURE

```text
/platform
├── apps
│   ├── api
│   │   ├── src
│   │   │   ├── app.module.ts
│   │   │   ├── main.ts
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── wallets/
│   │   │   ├── investments/
│   │   │   ├── trading/
│   │   │   ├── withdrawals/
│   │   │   ├── admin/
│   │   │   ├── audit/
│   │   │   ├── security/
│   │   │   └── common/
│   │   ├── test
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   └── web
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── public/
│       ├── package.json
│       ├── tsconfig.json
│       └── next.config.js
├── packages
│   ├── types
│   │   ├── src
│   │   └── package.json
│   ├── financial-engine
│   │   ├── src
│   │   └── package.json
│   └── ui
│       ├── src
│       └── package.json
├── database
│   ├── migrations/
│   ├── seeds/
│   └── schema.sql
├── docker
│   ├── nginx/
│   └── scripts/
├── docs
│   ├── architecture.md
│   ├── erd.md
│   └── project-structure.md
├── scripts
│   ├── dev.sh
│   └── prod.sh
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── README.md
├── tsconfig.base.json
└── tests
    ├── unit/
    ├── integration/
    ├── e2e/
    └── security/
```

## File-role summary

- apps/api: REST API, auth, financial accounting services, admin APIs
- apps/web: user and admin interfaces
- packages/types: shared domain contracts and enumerations
- packages/financial-engine: money calculations, fees, maturity logic, risk scoring helpers
- database: migrations and seeded demo data
- docs: architecture and design documentation
- scripts: start, build, and deployment commands
- tests: service, security, and workflow validation
