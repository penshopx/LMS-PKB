#!/bin/bash
set -e

echo "[post-merge] Installing dependencies..."
npm install

if [ -n "$DATABASE_URL" ]; then
  echo "[post-merge] Running database migrations..."
  npm run db:push
else
  echo "[post-merge] DATABASE_URL not set, skipping db:push."
fi

echo "[post-merge] Done."
