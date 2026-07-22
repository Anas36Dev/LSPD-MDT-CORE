# syntax=docker/dockerfile:1

# =============================================================================
# LSPD MDT — image de production (Next.js 16 + Prisma 7 / adaptateur MariaDB)
# Build multi-étapes : dépendances → build → runtime.
# =============================================================================

# ---- Base commune -----------------------------------------------------------
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# openssl : requis par le moteur de migration Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ---- Dépendances ------------------------------------------------------------
# NODE_ENV non défini ici : on veut aussi les devDependencies (build + tsx/prisma).
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Build ------------------------------------------------------------------
FROM base AS builder
# URL factice : `prisma generate` et `next build` ne se connectent jamais à la
# base, mais prisma.config.ts exige que la variable soit définie.
ENV DATABASE_URL="mysql://build:build@localhost:3306/build"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Génère le client Prisma (aucune connexion DB requise), puis compile Next.
RUN npx prisma generate
RUN npm run build

# ---- Runtime ----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3080
ENV HOSTNAME=0.0.0.0

# Utilisateur non-root.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

# On copie l'application complète depuis le builder (app + node_modules avec
# prisma CLI et tsx, nécessaires aux migrations et au seed au démarrage).
COPY --from=builder /app ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p public/uploads/chat public/uploads/evidence \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3080

# Health : le serveur répond (statut < 500) sur le port 3080.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3080/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
