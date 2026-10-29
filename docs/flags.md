# Flags

Every switch this project has, what it changes, who owns it and what
it defaults to.

A switch that is off must mean the reader sees exactly what they saw
before. That is not a wish; it is tested. `frontend/src/utils/__tests__/featureFlags.test.js`
asserts the off case for each one.

## Build switches

Read from the environment when the bundle is built. Fixed for the life
of the build, so every part of the bundle agrees about them.

| Flag | Default | Batch | What it changes |
|---|---|---|---|
| `VITE_UI_POLISH` | OFF | A2 | The tidied-up page headers (`PageHeader`) and the single icon family in place of emoji. Also gates the A7 insights panel and the A7 privacy page. Absent or `"0"` is off; `"1"` is on. |

## Reader switches

Stored in the browser under one key (`featureFlags`), so the whole set
can be cleared in one go. Off to begin with.

| Switch | Default | Batch | What it changes |
|---|---|---|---|
| `navV2` | OFF | A5 | The grouped sidebar, alongside the old one. |
| `singleAdd` | OFF | A5 | One primary add action in the same place on each page. |
| `advancedFeatures` | OFF | A5 | The merchant page, and other advanced screens, behind an opt-in. |
| `reminders` | OFF | A5 | Reminders. They compute what to remind about; they send nothing. |

## Environment values that are not switches

These are configuration, not features. They are listed here so nobody
mistakes one for a flag.

| Value | Where | Note |
|---|---|---|
| `VITE_API_URL` | `frontend/src/config/api.js`, `src/config/url.js`, `src/services/api.js`, `src/context/AuthContext.jsx`, `src/hooks/useApi.js` | The backend base URL. The default points at production, so a local run must set it explicitly (`VITE_API_URL=/api`). |
| `VITE_SUPABASE_URL` | `frontend/src/lib/supabase.js`, `src/lib/api-supabase.js` | Supabase project URL for OAuth. |
| `VITE_SUPABASE_ANON_KEY` | `frontend/src/lib/supabase.js` | Supabase anonymous key. |

## Experiments

Not switches. An experiment has two versions, and the reader is put
into one of them on their own device. The version a reader sees never
changes, so the comparison means something.

The assignment is kept in the browser under `abExperiments`, and the
reader's own key under `abReaderKey`. Nothing is sent anywhere. There
is no server, no account and no identifier that leaves the device; the
counts are read back from the same place they were written.

| Experiment | Versions | Where | What it changes |
|---|---|---|---|
| `exp_budget_wizard` | `control` / `recipe` | `frontend/src/pages/Budgets.jsx` | The empty budget page. The plain one has the ordinary form; the recipe one also offers the instant budget recipes under the explanation. |
| `exp_empty_state` | `control` / `honest` | `frontend/src/components/common/HonestEmptyState.jsx` | Every empty page that uses the honest empty state. The plain one is the title, the explanation and one button; the honest one adds the mascot, the hint and the second action. |

`frontend/src/utils/abTesting.js` holds the registry. An experiment
that is not named there does not run. `frontend/src/utils/__tests__/abTesting.test.js`
checks that the split is even, that a reader keeps the same version,
and that nothing leaves the device.

To see the other version on this device, clear the assignment:
`localStorage.removeItem('abExperiments')` and reload.

## Flags named but not yet built

These appear in the queue. When one is built it gets a row here in the
same commit that introduces it.

| Flag | Default | Batch | What it changes |
|---|---|---|---|
| `AI_CONFIRM_MUTATIONS` | OFF | A4.4 (Q4) | Server-side confirmation before an AI feature mutates data, with an audit-log entry. Nothing changes while off. |
| (delete-all safeguards) | OFF | A4.5 (Q5) | Confirmation token, rate limit and audit entry on delete-all. The endpoint contract does not change while off. |
| (location consent) | OFF | A4.7 (Q7) | Opt-in screen and a persisted consent flag. No coordinates are stored without consent. |
