# Build stage
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install OpenSSL for Prisma (REQUIRED!)
RUN apk add --no-cache openssl openssl-dev libc6-compat

WORKDIR /app

# Copy package files and install ALL deps (tsx needed at runtime)
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server and other needed files
COPY server ./server
COPY public ./public
COPY scripts ./scripts

# Create data directory for SQLite
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/app.db"
ENV PORT=3001

# Expose port
EXPOSE 3001

# Initialize database and start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx server/index.ts"]
