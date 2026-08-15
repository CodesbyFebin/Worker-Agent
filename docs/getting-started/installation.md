# Installation

## Prerequisites

- Node.js >= 20.x
- npm >= 10.x
- MariaDB 11.4+ (or Docker)
- Redis 7+ (or Docker)

## Quick Start

```bash
git clone https://github.com/CodesbyFebin/Worker-Agent.git
cd Worker-Agent
npm install
cp .env.example .env
npm run dev:all
```

## Docker Setup

```bash
docker-compose up -d mysql redis
npm --prefix server run dev:api
npm --prefix server run dev:worker
npm --prefix client run dev
```

## Production (Docker Compose)

```bash
docker-compose --profile production up -d
```
