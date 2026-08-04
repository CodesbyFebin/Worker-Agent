# Multi-stage Dockerfile for local compose / CI images.
# Development on Windows still prefers `npm run local:infra` + `npm run dev`.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4000
CMD ["npm", "run", "start:api", "--workspace=server"]

FROM node:20-bookworm-slim AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
CMD ["npm", "run", "start:worker", "--workspace=server"]

FROM node:20-bookworm-slim AS client
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/client
EXPOSE 5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
