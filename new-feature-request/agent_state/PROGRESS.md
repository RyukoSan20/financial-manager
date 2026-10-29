# PROGRESS

Last updated (2026-10-29, anti-slop redesign session)

NEXT ACTION
The redesign batch is built and the tree is green. Nothing is in
flight. The next thing to do is the owner's review of this batch, and
then the remaining items of the master prompt that were not reached:
the `ConfirmDialog`, the inline amount evaluator in the quick entry,
the nav grouping refinement, and the four A7 rows that are still
waiting for a mini-spec.

IN-FLIGHT
Nothing. The tree is clean and the preflight passes.

  The privacy manifest question (3.6) is RESOLVED. The file was
  restored to its last green state and the text was moved into the
  existing i18n through frontend/src/i18n/keys_batch8.js. The manifest
  now holds facts only; the page holds the wording. Test: 322/322.

  The A6 transfer-sign work is COMMITTED. It was reviewed as one
  coherent change and committed per purpose, without mixing in other
  files. It is no longer uncommitted work.

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
  A7-4  | privacy manifest multilingual  | done              | fca9d1e                                   | privacyManifest 322/322
  A7-5  | A7 rows 2, 6, 21, 27, 38, 79   | not-started        | (none)                                    | needs mini-spec + approval
  A7-6  | A7 migration-backed rows        | not-started        | (none)                                    | needs ADR + approval
        |   (24, 25, 32, 33, 36, 40, 76)  |                   |                                           | migrations NOT executed
  UI-1  | anti-slop components           | done              | bc938cb                                  | mascot + honest empty state
        |   (mascot, empty state, motion) |                   |                                           | + motion.css, layered surface
  UI-2  | local A/B testing               | done              | a202779                                  | abTesting 34/34
        |                                |                   |                                           | 2 experiments, nothing sent
  UI-3  | budget recipes + empty page     | done              | 398ec69 e90eb0b                          | budgetRecipes 48/48
        |   (50/30/20 and three others)  |                   |                                           | + 5 pages use the empty state
  UI-4  | route smoke test                | done              | c72edd2                                  | smoke_all_routers 8/8
        |                                |                   |                                           | + scripts/smoke_test_routes.py
  UI-5  | the scan notification          | done              | (earlier session)                         | scanDismissal 38/38
  UI-6  | the charts and the analytics    | done              | (earlier session)                         | idFormat 63/63
        |                                |                   |                                           | healthMetrics 22/22
  UI-7  | the market page numbers         | done              | 2b289f2                                  | marketFormat 32/32
        |                                |                   |                                           | marketPage 8/8
  UI-8  | the hooks and the i18n of the   | done              | 7f10204 c41453c 9674dac 494725d         | preflight green
        |   navigation                    |                   | 2e910fe 2bb84d2 5f27e85                 | backend 256 passed
  UI-9  | the build has to be able to     | done              | e6c758c                                  | route count guard
        |   fail                          |                   |                                           | + post-deploy smoke test

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

  2026-10-29T00:00:00+0700  Anti-slop redesign session. Picked up
  from a green tree. Work in this session, all committed, preflight
  green at the end:

  UI-1 bc938cb: FinBuddyMascot (4 moods), HonestEmptyState, and
    styles/motion.css. The layered card surface and the tabular
    figures went into styles/polish.css.
  UI-2 a202779: frontend/src/utils/abTesting.js. Two experiments,
    exp_budget_wizard and exp_empty_state. The split is decided by a
    hash of the reader's own key with the experiment name, so it is
    even (987/1013 over a thousand readers) and a reader keeps the
    same version. Nothing leaves the device.
  UI-3 398ec69, e90eb0b: the four budget recipes (Si Seimbang
    50/30/20, Si Pejuang Cuan 40/20/40, Si Anak Kota 60/20/20, Si
    Pelunas 50/20/30) with the amount per day worked out from them.
    Five pages now use the honest empty state.
  UI-4 c72edd2: scripts/smoke_test_routes.py and
    backend/tests/unit/test_smoke_all_routers.py. The check found
    thirteen paths registered twice. Thirteen are on the known list,
    with the reason for each; the market one is deliberate, the rest
    are not, and the second registration of each is the one that is
    never reached. That is a finding about main, not a change to it.
  UI-7 2b289f2: the market page was writing "undefined%" and "-%"
    where a change was missing, and the table view opened on a tab the
    page cannot draw. Fixed through a shared formatter.
  UI-8: seven commits of real fixes found while the tree was dirty:
    the market page, the stale-closure hooks, the duplicate
    notification ids, the navigation labels, the debt schedule (it is
    an object, and it was read as an array), the amount parser, and
    the i18n checker.
  UI-9 e6c758c: the CI ran the backend tests with "|| echo", so a
    failing test could not fail the build. That is how the broken
    Gmail import reached a deployment. The tests block now. The route
    count is written down in scripts/route_count_guard.txt and the
    build checks it. The post-deploy smoke test now probes the
    endpoints that need a reader and fails on a 404, which is the
    failure that is worth catching.

  Backend: 256 passed, 0 failed. Lint: 0 errors, 204 warnings.
  Build: PASS. Preflight: PASSED.

  STILL NOT DONE, from the master prompt: ConfirmDialog, the inline
  amount evaluator in the quick entry box, the nav grouping
  refinement, the two Recipes sliders being interactive on every
  recipe, and the A7 rows that need a mini-spec.
