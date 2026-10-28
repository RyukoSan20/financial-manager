# The root structure, and what is actually deployed

Everything below was read out of the repo at `chore/baseline-remediation`
(commit `6711804`). The deployment facts come from the deploy workflow,
the nginx config and the compose files — not from the older
`DEPLOYMENT.md`, which still describes the Vercel + Railway setup that
has been replaced.

## The root, as it stands on disk

```
/Users/rafi/fm-baseline/            ← the working worktree
├── .env.example
├── .github/
│   └── workflows/
│       ├── ci.yml                  ← test + build on push/PR
│       └── deploy.yml              ← deploy to the VPS on push to main
├── .gitignore
├── AUDIT_REPORT.md
├── DEPLOYMENT.md                   ← STALE. describes Vercel + Railway
├── Dockerfile                      ← backend image, python:3.12-slim
├── LICENSE
├── RAILWAY_SETUP.md                ← STALE
├── README.md
├── UI_REDESIGN_PLAN.md
├── docker-compose.yml              ← local dev: postgres + backend
├── docker/                         ← the server deployment
│   ├── Dockerfile
│   ├── README.md
│   ├── deploy-vps.sh
│   ├── docker-compose.yml          ← THE SERVER COMPOSE
│   ├── init-scripts/01-init.sql
│   ├── nginx/nginx.conf
│   ├── start-local.sh
│   └── start.sh
├── docs/
│   ├── ARCHITECTURE_MAP.md
│   ├── FEATURE_ROADMAP_INVESTOR.md
│   ├── RAILWAY_BACKUP.md
│   ├── RAILWAY_ENV_TEMPLATE.env
│   ├── SPEC_TIMEFRAME_FILTER.md
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── flags.md
│   └── metrics.md
├── frontend/
├── backend/
├── new-feature-request/
├── scripts/
│   ├── agent_preflight.sh
│   ├── check_duplicate_keys.py
│   ├── check_hardcoded_text.py
│   ├── check_i18n.py
│   └── check_undefined.py
├── financial_manager.db            ← 0 bytes, gitignored
├── nginx.conf                      ← THE PRODUCTION NGINX CONFIG
├── qa_extended.py
├── qa_test.py
├── railway.json                    ← STALE
├── railway_backup.json
├── railway_backup.sql
├── setup-local.sh
├── start-local-full.sh
├── start-local-python.sh
├── start-local.sh
├── start-with-tunnel.sh
└── vercel.json                     ← STALE
```

Untracked and not part of the project: `ErrorFeed/`, `sample/`,
`supabase/`, `testocr/` (reference material), `backend/venv/`,
`frontend/node_modules/`.

### `backend/`

```
backend/
├── app/                     ← the application
│   ├── api/routes/          44 route files
│   ├── core/                16 files (security, database, kms, rate_limit)
│   ├── middleware/          logging
│   ├── models/              23 SQLAlchemy models
│   ├── modules/             29 files (ai_advisor, email_parser, ledger)
│   ├── schemas/             15 Pydantic schemas
│   ├── services/            69 service files
│   ├── main.py              ← registers 45 routers
│   └── config.py
├── alembic/                 alembic env + script template
├── migrations/              3 version files + 2 standalone scripts
│   └── versions/
│       ├── 20261020_shopping_pipeline.py
│       ├── 20261021_user_settings.py
│       └── 20261023_merchant_catalog.py
├── tests/                   15 test files
│   ├── conftest.py
│   ├── test_cross_page_consistency.py
│   ├── test_intent_classifier.py
│   ├── test_metrics_consistency.py
│   ├── integration/
│   └── unit/                13 test files
├── alembic.ini
├── pyproject.toml           ← pytest lives here, in [dev] only
├── pytest.ini
├── requirements.txt         ← what the production image installs
├── requirements-minimal.txt ← what Dockerfile.local installs
├── requirements-light.txt   ← has pytest, but no Dockerfile uses it
├── requirements.txt.new     ← has pytest, but no Dockerfile uses it
├── Dockerfile
├── Dockerfile.local
├── railway.json             ← STALE
├── run.sh / start.sh        ← LOCAL ONLY, hardcoded to /Users/rafi/...
├── backup_restore.py
├── migrate_receipt.py
├── run_server.py
├── financial_manager.db     ← gitignored
└── a7_local.db              ← gitignored, from the A7 verification run
```

### `frontend/`

```
frontend/
├── src/
│   ├── pages/               33 .jsx
│   │   └── Settings/        8 sub-pages, incl. PrivacyPage.jsx
│   ├── components/          48 .jsx in 11 folders
│   ├── context/             AuthContext.jsx
│   ├── contexts/            ThemeContext.jsx, NotificationContext.jsx
│   ├── hooks/               useApi.js, useSyncedPreference.js
│   ├── i18n/                index.jsx + id/en/ja + keys_batch1..7
│   ├── lib/                 supabase
│   ├── services/            api.js, merchantApi.js, scanManager.js
│   ├── styles/              polish.css, insights.css, privacy.css
│   ├── utils/               idFormat, amountInput, icons, featureFlags…
│   ├── App.jsx              ← the routes
│   ├── main.jsx             ← imports the 3 stylesheets
│   ├── index.css            53 kB
│   └── config/              api.js, url.js
├── public/
│   ├── favicon.svg
│   ├── icons/
│   ├── manifest.json
│   └── sw.js                ← the service worker
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .eslintrc.cjs
├── playwright.config.ts
├── vercel.json              ← STALE
├── .env.example
└── README.md
```

## What is actually deployed on the server

The server runs **one Docker Compose project** with **three
containers**, all from `docker/docker-compose.yml`.

```
                    the browser
                         │
             https://my-financial-manager.online
                         │
              ┌──────────▼───────────┐
              │  nginx  (container)  │   nginx:alpine
              │  finmanager-proxy    │
              │  serves the static   │
              │  frontend, proxies   │
              │  /api/ to the backend│
              └──────────┬───────────┘
                         │  upstream backend:8000
              ┌──────────▼───────────┐
              │ backend (container)  │   from docker/Dockerfile
              │  finmanager-api      │
              │  uvicorn :8000       │
              └──────────┬───────────┘
                         │
              ┌──────────▼───────────┐
              │ postgres (container) │   postgres:15-alpine
              │  finmanager-db       │
              │  volume: ./volumes/  │
              │  postgres            │
              └──────────────────────┘
```

### The three containers

| Container | Image | Port | Notes |
|---|---|---|---|
| `finmanager-db` | postgres:15-alpine | 5432 (not published) | volume `./volumes/postgres`, seeded by `init-scripts/01-init.sql` |
| `finmanager-api` | built from `docker/Dockerfile` | 8000 | runs as non-root `appuser`; `requirements.txt`; healthcheck on `/health` |
| `finmanager-proxy` | nginx:alpine | 80, 443 | profile `production`; serves `frontend/dist` and proxies `/api/` |

### The nginx config that does it

`nginx.conf` at the **repo root** is the one that is deployed. It is
not the `docker/nginx/nginx.conf` — that one has `server_name _` and no
TLS, and its SSL block is commented out.

The deployed config:

- **TLS** on 443, certificate at `/etc/nginx/ssl/fullchain.pem`
- **Port 80** redirects to 443
- **Static frontend** from `root /usr/share/nginx/html`
- `/api/` → `proxy_pass http://backend`
- `/health`, `/ready`, `/realtime/` → the backend
- `/uploads/` → the backend
- `index.html` and `sw.js` are `no-cache, no-store` — otherwise the
  browser pins an old bundle hash and shows a blank page
- `/assets/` is `max-age=31536000, immutable`

### Rate limiting, in the deployed nginx

| Zone | Rate | Applies to |
|---|---|---|
| `default_limit` | 6000 r/m | all of `/api/` |
| `auth_limit` | 10 r/m | `/api/login`, `/register`, `/google/url`, `/supabase-exchange`, `/guest` |
| `search_limit` | 300 r/m | `/api/search`, `/api/shopping/price-comparison` |

`limit_req_status 429` — nginx answers 503 by default, which reads as
"the backend is down".

### The deploy pipeline

`.github/workflows/deploy.yml`, on push to `main`. It detects which
paths changed and only deploys those.

1. **Build frontend** with `VITE_API_URL=https://my-financial-manager.online/api`.
   Two guards run: the bundle must not contain `/api/api`, and
   `dist/sw.js` must exist.
2. **Backup** the current `frontend/dist` and `nginx.conf` into
   `/home/ubuntu/backups/<timestamp>/`.
3. **Backend**: tar `app`, `migrations`, `alembic.ini`; `docker cp`
   into the running container; then
   `python -c "from app.main import app; print(len(app.routes))"` —
   which fails the deploy if the app will not import.
4. **Migrations**: `alembic upgrade head` inside the container.
5. **Restart** the backend container and poll `/health` for up to 60 s.
6. **Frontend**: untar `frontend/dist` into
   `/home/ubuntu/finmanager/frontend/dist`.
7. **Nginx**: copy the config, `nginx -t`, reload.
8. **Smoke test**: `/health`, `/ready`, `/api/market/summary`,
   `/api/search/marketplaces` must all answer 200.

Secrets come from GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.

### Where things live on the server

```
/home/ubuntu/finmanager/
├── nginx.conf
├── frontend/dist/          ← the built frontend
└── (the compose project)
```

The compose project runs containers named `finmanager-backend-1`,
`finmanager-postgres-1`, `finmanager-nginx-1` — the workflow refers to
them by that name.

### The CI pipeline

`.github/workflows/ci.yml`, on push and PR to `main`. Three jobs.

**backend** — postgres:15 service, Python 3.12, install
`requirements.txt` plus pytest, then:
- import check: `from app.main import app; print(len(app.routes))`
- `pytest tests/unit -q` — **non-blocking** (`|| echo ...`)

**frontend** — Node 20:
- `npm ci`
- `npm run lint` — non-blocking
- the `no-undef` guard — this is the one that catches
  `language is not defined`
- `npm run test --if-present` — non-blocking
- `npm run build`
- `/api/api` guard, `sw.js` guard

**i18n** — three python scripts:
- `scripts/check_i18n.py` — every key exists in every language
- `scripts/check_undefined.py` — every helper is imported
- `scripts/check_duplicate_keys.py` — no key written twice

## What is deployed vs what is not

| File | Deployed? |
|---|---|
| `docker/docker-compose.yml` | **yes** — the server |
| `docker/Dockerfile` | **yes** — builds `finmanager-api` |
| `nginx.conf` (root) | **yes** — the server proxy config |
| `backend/requirements.txt` | **yes** — installed into the image |
| `backend/app/`, `backend/migrations/`, `backend/alembic.ini` | **yes** — copied in by the workflow |
| `frontend/dist/` | **yes** — built in CI, untarred onto the server |
| `Dockerfile` (root) | no — the same image, but the compose file points at `docker/Dockerfile` |
| `docker-compose.yml` (root) | no — local dev only (postgres 16, port 5433, `Dockerfile.local`) |
| `docker/nginx/nginx.conf` | no — not the one deployed |
| `backend/Dockerfile.local` | no — local dev |
| `vercel.json`, `railway.json`, `backend/railway.json` | no — the old setup |
| `DEPLOYMENT.md`, `RAILWAY_SETUP.md` | no — stale docs |
| `backend/run.sh`, `backend/start.sh` | no — hardcoded to `/Users/rafi/financial-manager` |
| `requirements-light.txt`, `requirements.txt.new` | no — no Dockerfile references them |
| `pyproject.toml` | no — no Dockerfile copies it, so **pytest does not reach the server** |

## Two things to fix

**The docs are behind the deployment.** `DEPLOYMENT.md` and
`RAILWAY_SETUP.md` still describe Vercel + Railway, and `vercel.json`
still rewrites `/api/*` to a Railway URL. Anyone following the docs
would deploy to the wrong place.

**`backend/run.sh` and `backend/start.sh` hardcode a Mac path**,
`/Users/rafi/financial-manager/backend`, and `start.sh` carries a
database URL with a password in it. They are local-only and gitignored
from the image, but they should not hold a credential.

## One thing the deploy pipeline does not check

The workflow's import check proves the app imports and counts the
routes. It does **not** call an endpoint. So a router that imports but
fails at request time still ships — which is exactly what happened with
the Gmail router on `main`: `main.py` wraps the import in
`try/except ImportError`, so the break was swallowed into a `[WARN]`
line and the routes silently never registered.
