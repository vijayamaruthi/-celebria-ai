# Multi-stage production build for Celebria AI
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Run tests to guarantee build integrity
RUN npm test

# Build production client bundle
RUN npm run build

# Stage 2: Minimal runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifests and production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy compiled frontend and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/src/types ./src/types
COPY --from=builder /app/src/utils ./src/utils

# Install tsx globally or locally to run TypeScript server
RUN npm install -g tsx

EXPOSE 3000

CMD ["tsx", "server.ts"]
