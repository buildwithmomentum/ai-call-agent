# Base stage for system dependencies
FROM node:22-slim AS base
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libnss3 \
    libfreetype6 \
    libharfbuzz-bin \
    libharfbuzz0b \
    ca-certificates \
    fonts-freefont-ttf \
    curl \
    unzip && \
    rm -rf /var/lib/apt/lists/*

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN bun install -g @nestjs/cli

# Build stage
FROM base AS build
WORKDIR /app

# Copy configuration files
COPY package.json package-lock.json tsconfig.json ./

# Install dependencies
RUN bun install

# Copy source files
COPY src/ ./src/
# USES ENV FROM WORKFLOW
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM base AS prod
WORKDIR /app

# Copy built files and dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/ ./

# Set environment variables
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3000

CMD ["bun", "run", "start:prod"]
