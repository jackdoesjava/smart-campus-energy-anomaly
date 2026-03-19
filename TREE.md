/
├── README.md
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── go.mod
│   └── internal/
│       ├── analytics/
│       │   └── zscore.go
│       ├── api/
│       │   ├── rest/
│       │   │   └── handlers.go
│       │   └── ws/
│       │       └── server.go
│       ├── database/
│       │   └── db.go
│       ├── ingestion/
│       │   └── workers.go
│       └── ml/
│           └── forecast.go
├── database/
│   └── migrations/
│       └── schema.sql
└── frontend/
    ├── package.json
    └── src/
        ├── assets/
        │   └── styles.css
        ├── components/
        │   ├── Dashboard.jsx
        │   ├── EventLog.jsx
        │   └── KPICards.jsx
        └── hooks/
            └── useData.js
