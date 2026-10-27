# PROGRESS

Last updated (2026-10-28T06:47:50+0700, reconcile-state session)

NEXT ACTION
Send the reconcile-state report (section 8 format) and STOP. Wait for
the owner's choice on 3.6 (privacy manifest: restore-and-redo versus
finish the refactor), and for approval of the next queue item (Q1).

IN-FLIGHT
Nothing. The previous session was interrupted during a privacy-manifest
refactor. The tree is NOT red because the broken work was never
committed: the working tree holds it as unstaged changes, and the last
commit (1e590f4) is green.

  - Frontend file left mid-refactor, uncommitted, owned by the agent:
      frontend/src/data/privacyManifest.js   (+400 / -40 vs HEAD)
    What was being done: the manifest's fact text was English-only, so
    the privacy page showed English facts on an Indonesian screen. The
    refactor moves that text into the existing i18n mechanism.
    State: STAYS_LOCAL converted. GOES_OUT corrupted - the agent's
    regex wrote three entries per item instead of one entry holding a
    three-language text block, so the file now has 30 GOES_OUT entries
    where it should have 10. NEVER_SENT not yet converted.
    How to continue: the owner has been asked to choose between
    (a) restore this one file to HEAD and redo the text through the
    existing i18n, or (b) finish the refactor. See 3.6 in the report.

  - Frontend uncommitted files owned by the agent, from the A6
    transfer-sign work that was never committed:
      backend/app/api/routes/dashboard.py
      frontend/public/sw.js
      frontend/src/components/common/ErrorBoundary.tsx
      frontend/src/components/dashboard/MonthTimeline.jsx
      frontend/src/components/layout/AddTransactionPage.jsx
      frontend/src/components/ui/PixelBadge.jsx
      frontend/src/features/shopping/api.js
      frontend/src/pages/CategoryExpenses.jsx
      frontend/src/pages/Dashboard.jsx
      frontend/src/pages/Feed/FeedPage.jsx
      frontend/src/pages/ProfileSummary.jsx
      frontend/src/pages/Recurring.jsx
      frontend/src/pages/Transactions.jsx
      frontend/src/utils/transactionSign.js            (untracked)
      frontend/src/utils/__tests__/transactionSign.test.js (untracked)
    These are NOT part of the privacy manifest. They are the A6
    transfer-sign change (a transfer is not income and not an
    expense) plus two small fixes found alongside it.

BATCH LEDGER

  ID    | title                          | status            | commits                                   | tests + flags
  ------+--------------------------------+-------------------+-------------------------------------------+--------------------------
  S0    | reconcile the feature matrix    | done              | 8be4ed0                                   | 82 matrix rows reconciled
  A1    | trust and data consistency      | built-unapproved  | 54d9afb 90153aa 0f119dd 514b696          | backend 77 passed
        |                                |                   | 998eed5 1ff94de 347c08e d207403 374fbf9   | idFormat 46/46
  A2    | visual consistency              | built-unapproved  | 16 commits (cabf0d2..55232ab)             | featureFlags 20/20
        |                                |                   |                                           | VITE_UI_POLISH (default OFF)
  A3    | language + Indonesia calculators| built-unapproved  | 21 commits (3af859b..100f1d9)             | terminology 25/25
        |                                |                   |                                           | backend 118 passed
  A4    | Gmail states + delete guard     | built-unapproved  | 52eaf65 875c6ed 72abf25 d184af9          | backend 135 passed
        |                                |                   | 0037196 c1a38d8 d868bf3 09c0acb 510b8d9   |
  SCAN  | scan leaves a transaction       | built-unapproved  | 1fcff83 bd1c393                           | backend 135 passed
  A5    | reminders, nav, onboarding      | built-unapproved  | 12 commits (88e7cf1..bc4f973)             | navGrouping 45/45
        |                                |                   |                                           | backend 148 passed
  A6    | transfers + amount input        | built-unapproved  | 1fb3d64 c4edc01 9cddb3d ad7698c f54c4b6  | amountInput 31/31
        |                                |                   |                                           | transferAtomicity passed
  A7-1  | four insight detectors (backend)| built-unapproved | bd9ab44                                   | 19 service + 10 API passed
  A7-2  | insights panel on the dashboard | built-unapproved  | 3b0c7ce                                   | batchParity 5411/5411
  A7-3  | privacy page                    | built-unapproved  | 1e590f4                                   | privacyManifest 128/128
        |                                |                   |                                           | VITE_UI_POLISH (default OFF)
  A7-4  | privacy manifest multilingual  | not-started        | (none)                                    | BLOCKED on owner choice 3.6
  A7-5  | A7 rows 2, 6, 21, 27, 38, 79   | not-started        | (none)                                    | needs mini-spec + approval
  A7-6  | A7 migration-backed rows        | not-started        | (none)                                    | needs ADR + approval
        |   (24, 25, 32, 33, 36, 40, 76)  |                   |                                           | migrations NOT executed

  Every A1-A7 batch is "built-unapproved". Nothing after Stage 0 has
  been signed off. The owner has accepted only the Stage 0 report.

SUBTASKS for the active batch

  Reconcile-state batch (this session):
  - [x] 3.1 git status, log, worktree list, branch -a; mark file ownership
  - [x] 3.2 create and commit agent_state/PROGRESS.md
  - [x] 3.3 create and commit agent_state/CONSTRAINTS.md
  - [x] 3.4 create scripts/agent_preflight.sh
  - [x] 3.5 scope review table of everything built after Stage 0
  - [x] 3.6 report the broken manifest; do not continue it; report i18n
  - [x] 3.7 determine whether the Gmail break exists on main, and since when
  - [x] 3.8 re-run lint, build, frontend tests, backend pytest; report raw
  - [ ] send the report and STOP

DECISIONS LOG

  D1  (2026-10-28) qa/analisis_ui.xlsx is the WRONG workbook (an older
      Monveo-only file). The correct one will be placed there. Until
      then the S1-S25 table in section 4 of the owner's message is
      authoritative. The wrong file is to be COPIED to qa/_superseded/,
      not deleted. NOT YET DONE - needs the owner's file first.
  D2  (2026-10-28) qa/expansion_scope.md is the correct path. Stage B
      stays gated: Stage A sign-off plus separate approval per item.
  D3  (2026-10-28) pytest is approved as a DEV dependency only.
      VERIFIED 2026-10-28: pytest is NOT in backend/requirements.txt
      (the file the production Dockerfile installs) and NOT in
      backend/requirements-minimal.txt (Dockerfile.local). It is in
      backend/pyproject.toml under [project.optional-dependencies] dev,
      and in backend/requirements-light.txt and
      backend/requirements.txt.new (neither is used by a Dockerfile).
      No Dockerfile copies or installs pyproject.toml. The CI workflow
      installs pytest separately in its own step.
      CONCLUSION: pytest does not reach the production image.
  D4  (2026-10-28) A1 is narrowed. Closed, already satisfied, do not
      fix again: S2, S3, S4, S8, S22. S16 frontend part is closed; only
      the server part remains (queue Q5).
  D5  (2026-10-28) The A1 allowed-files list is approved, within the
      C6 caps.
  D6  (2026-10-28) The A7 scope split (18 in / 18 out) is
      provisionally accepted. From now on: MAX 3 A7 ITEMS PER APPROVAL,
      each with a one-page mini-spec BEFORE code.
      NOTE: the three A7 commits already made (bd9ab44, 3b0c7ce,
      1e590f4) predate this rule and did not have mini-specs. They are
      listed for approval in the scope review table.
  D7  (2026-10-28) Use the app's EXISTING i18n mechanism for all text.
      Do not create a second strings system.
      VERIFIED: the existing mechanism is frontend/src/i18n/index.jsx,
      which holds the three locale tables (id/en/ja) plus a `t(key,
      fallback, values)` lookup that falls back to English and then to a
      humanised last key segment. Batch files (keys_batch1..7) are
      separate modules imported by the component that uses them, NOT
      merged into the locale tables. This is the existing mechanism and
      the manifest refactor must use it, not a new one.

OPEN QUESTIONS / BLOCKERS

  - 3.6: the owner must choose (a) restore the manifest to HEAD and
    redo the text through the existing i18n, or (b) finish the
    refactor as it stands. NOT CONTINUED until chosen.
  - Q1 asks for the smallest change that makes /api/integrations/gmail/*
    importable again. The break is on main, not on this branch, and
    the owner has not yet confirmed which file the fix belongs in.
  - The A1-A7 batches are all built but unapproved. The scope review
    table in the report lists a keep / needs-approval / revert
    recommendation for each commit. Nothing has been reverted.
  - The uncommitted A6 transfer-sign work (13 modified files + 2
    untracked) has never been committed and is not part of any
    approved item. It needs a decision.

SESSION LOG

  2026-10-28T06:47:50+0700  Reconcile-state session started. Read
  git state (79 commits on chore/baseline-remediation, 58 new files,
  +14080/-414 lines). Confirmed the worktree list: main at
  /Users/rafi/financial-manager (untouched), the branch at
  /Users/rafi/fm-baseline. Traced the Gmail import break to commit
  b6a6069 (2026-10-18), which removed class GmailService from
  gmail_oauth.py while email_poller.py and email_parser/__init__.py
  still import it; that commit is an ancestor of main. Verified D3:
  pytest is not in the production dependency set. Wrote this file and
  CONSTRAINTS.md, and scripts/agent_preflight.sh.

  2026-10-28T06:55:00+0700  Committed 66400a2 (agent_state: PROGRESS.md,
  CONSTRAINTS.md, agent_preflight.sh) and 509bb71 (docs/flags.md).
  Ran the preflight: it exits 1, correctly, because the uncommitted
  privacy manifest fails its test. Lint 0 errors / 204 warnings, backend
  pytest 192 passed, build PASS. Built main in a detached worktree for
  a like-for-like chunk comparison, then removed it: main main chunk
  1,518.56 kB (gzip 422.59 kB), this branch 1,619.26 kB (gzip 453.99 kB),
  +100.70 kB raw / +31.40 kB gzip.
  Measured the C6 caps: 4 commits exceed 150 changed lines against
  existing files alone (90153aa 158, f440b17 331, bc4f973 171,
  c4edc01 163) and 20 commits exceed 40 lines on a single existing
  file. All are listed in the report for the owner to accept or cut.
  STOPPED here to send the report.
