# TokenFusion AI

**One Token, Unlimited AI** — All-in-one AI Suite with unified token billing.

## Overview

TokenFusion AI is an AI capability aggregation platform targeting Southeast Asian and global markets. It aggregates Chat / Image / Video / Code generation capabilities with a unified Token billing system and OpenAI-compatible developer API.

## Architecture

```
Frontend (Next.js 14) → Backend (NestJS) → API Gateway (Go/Gin) → Underlying AI APIs
```

| Service | Directory | Tech Stack |
|---------|-----------|------------|
| Frontend | `tokenfusionweb/` | Next.js 14 App Router + TypeScript + Tailwind CSS v3 + Shadcn UI + Zustand + next-intl |
| Backend | `tokenfusionserver/` | NestJS + TypeScript + PostgreSQL + Redis + TypeORM |
| Gateway | `tokenfusiongateway/` | Go + Gin + Redis |

## Supported Languages

English (default), 简体中文, ภาษาไทย, Tiếng Việt, Bahasa Indonesia, Bahasa Melayu, Filipino

## Quick Start

### Prerequisites

- Node.js 20+
- Go 1.21+
- Docker & Docker Compose

### 1. Start infrastructure

```bash
cd deploy
docker-compose -f docker-compose.dev.yml up -d
```

### 2. Start backend

```bash
cd tokenfusionserver
cp .env.example .env.development
npm install
npm run start:dev
```

### 3. Start gateway

```bash
cd tokenfusiongateway
cp .env.example .env
go run cmd/gateway/main.go
```

### 4. Start frontend

```bash
cd tokenfusionweb
cp .env.example .env.development
npm install
npm run dev
```

## Development Rules

1. **No mock data** — All code must work with real backends, databases, and third-party services.
2. **Full i18n** — All user-visible text must be translated across 7 supported languages.
3. **Clean directory** — Test files are cleaned up after use; no redundant files.

## License

Proprietary - TokenFusion AI
