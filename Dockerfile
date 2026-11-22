# DAMIR — production image (Next.js standalone)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# Standalone prisma CLI (with its own dependencies) for running migrations at start
RUN npm install --prefix /migrate --no-save --no-package-lock --no-audit --no-fund prisma@$(node -p "require('./node_modules/prisma/package.json').version")

FROM node:22-alpine AS run
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 UPLOAD_DIR=/data/uploads
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /migrate ./migrate
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=build /app/scripts/bootstrap-admin.cjs ./scripts/bootstrap-admin.cjs
RUN mkdir -p /data/uploads && chown -R app:app /data
USER app
EXPOSE 3000
# Apply pending migrations, create the admin from ADMIN_EMAIL/ADMIN_PASSWORD if needed, then start
CMD ["sh", "-c", "node migrate/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma && node scripts/bootstrap-admin.cjs && node server.js"]
