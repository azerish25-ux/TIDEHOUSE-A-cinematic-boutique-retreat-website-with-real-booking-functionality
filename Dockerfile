FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run typecheck && npm run build
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY --from=build /app/out ./out
COPY --from=build /app/server ./server
COPY --from=build /app/lib ./lib
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts
USER node
EXPOSE 3000
CMD ["npm", "start"]
