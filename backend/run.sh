#!/bin/bash
#
# Run the backend on this machine, for development.
#
# The database address comes from the environment, not from here. It is
# read from the backend's own .env file when there is one, so the
# password is never written into a file that is in the repository.
#
# This is for development only. The server runs in Docker, and the
# deploy workflow copies the code into the running container. See
# docs/DEPLOYMENT_MAP.md for what the server actually does.

set -euo pipefail

# The directory this script lives in, so it can be run from anywhere.
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BACKEND_DIR"

# The environment file, if there is one. It is read but not written.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# The database, if it has not been given already.
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set." >&2
  echo "Put it in backend/.env, or set it in the environment before running." >&2
  echo "See backend/.env.example for the shape of it." >&2
  exit 1
fi

# The virtual environment, if there is one.
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
