#!/bin/bash
#
# Start the backend on this machine, for development.
#
# This is the one that reads the environment file. It is the same as
# run.sh, kept as a separate name because the older instructions and
# the habit of muscle memory both reach for "start.sh".
#
# The database address comes from the environment, never from here. See
# backend/run.sh for the long version, and docs/DEPLOYMENT_MAP.md for
# what the server actually does.

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BACKEND_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set." >&2
  echo "Put it in backend/.env, or set it in the environment before running." >&2
  echo "See backend/.env.example for the shape of it." >&2
  exit 1
fi

if [ -x venv/bin/activate ]; then
  source venv/bin/activate
elif [ -x .venv/bin/activate ]; then
  source .venv/bin/activate
else
  echo "No virtual environment found in backend/." >&2
  echo "Create one with: python3 -m venv venv" >&2
  exit 1
fi

exec uvicorn app.main:app \
  --host "${HOST:-127.0.0.1}" \
  --port "${PORT:-8000}" \
  --reload
