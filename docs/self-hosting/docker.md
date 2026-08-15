# Docker Deployment

The fastest way to run Worker Agent locally or in production.

## docker-compose.yml

```yaml
services:
  mysql:
    image: mariadb:11.4
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: worker_agent
    ports:
      - "3306:3306"

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"

  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: api
    restart: unless-stopped
    env_file: .env
    ports:
      - "4000:4000"
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: worker
    restart: unless-stopped
    env_file: .env
    depends_on:
      - api

  client:
    build:
      context: .
      dockerfile: Dockerfile
      target: client
    restart: unless-stopped
    environment:
      VITE_API_URL: http://localhost:4000/trpc
    ports:
      - "5173:5173"
    depends_on:
      - api
```

## Running

```bash
docker-compose up -d
docker-compose exec api npx drizzle-kit db:push --config=drizzle.config.ts
```

## Production Notes

- Use `--target=api` and `--target=client` for production builds
- Set `NODE_ENV=production`
- Use proper SSL termination (see nginx config)
- Configure proper database credentials