# FarmSense Brew — API + web frontend container (FB-52)
# Build (from the farmsense-brew directory):
#   podman build -t farmsense-api .
# Run standalone (expects MySQL/Grafana reachable via env vars):
#   podman run -d -p 3001:3001 --env-file deploy/env.container farmsense-api
# Normally run via the compose stack instead: podman compose up -d --build
#
# node:24 is required for the built-in node:sqlite offline buffer (FB-55).
# Red Hat-aligned alternative: registry.access.redhat.com/ubi9/nodejs-22
# (needs --experimental-sqlite added to CMD on Node 22).
FROM docker.io/library/node:24-slim

ENV NODE_ENV=production
WORKDIR /opt/farmsense

# Install backend dependencies first for layer caching
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Backend source + static frontend (landing, dashboards, built React app)
COPY backend ./backend
COPY frontend ./frontend

# Writable dir for the SQLite offline buffer + run as non-root
RUN mkdir -p /opt/farmsense/backend/data && chown -R node:node /opt/farmsense
USER node

WORKDIR /opt/farmsense/backend
EXPOSE 3001
CMD ["node", "server.js"]
