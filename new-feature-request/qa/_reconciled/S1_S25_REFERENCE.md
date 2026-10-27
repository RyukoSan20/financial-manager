# S1 to S25

The workbook `analisis_ui.xlsx` does not contain a sheet called
`Saran Prioritas` with S1 to S25 in column A, so the list could not be
read from it. The list below is the one from the task brief (section 6),
and it is the authority for this work.

`new-feature-request/qa/analisis_ui.xlsx` has these sheets instead:
`Ringkasan`, `Prioritas Fitur`, `Rencana 2 Hari`, `Ditunda`,
`Breakdown Monveo`, `Catatan Sumber`. `Prioritas Fitur` holds seven
numbered items about an app called Monveo, which is not this app and
has no screenshots here. It was not mapped onto S1 to S25, because
guessing which of seven unrelated items meant which of twenty-five
would have invented work rather than recovered it.

## The list

| ID | Item |
|----|------|
| S1 | single source of truth for balance, score, transaction counts |
| S2 | health sub-scores on empty data |
| S3 | AI Advisor minimum-data threshold and disclaimers |
| S4 | default accent not red |
| S5 | one PageHeader pattern |
| S6 | Indonesian UI strings and consistent terms |
| S7 | date/rupiah format utilities and chart axis |
| S8 | non-ASCII text bugs |
| S9 | sidebar grouping |
| S10 | Merchant behind advanced-features flag |
| S11 | onboarding |
| S12 | "this month" timeline |
| S13 | Gmail Sync states |
| S14 | chart single-slice/empty state |
| S15 | sidebar profile card |
| S16 | Delete All Data safeguards |
| S17 | initial balance and negative balance warning |
| S18 | one icon family |
| S19 | friendly streak |
| S20 | input flow |
| S21 | single add button |
| S22 | Indonesia-relevant calculators |
| S23 | accessibility audit |
| S24 | mobile review |
| S25 | opt-in reminders |

## Where each one is handled

| Batch | IDs | State |
|-------|-----|-------|
| A1 | S1, S2, S3, S7, S8, S14, S17 | done |
| A2 | S4, S5, S15, S18 | done |
| A3 | S6, S22 | done |
| A4 | S13, S16 | done |
| A5 | S9, S10, S11, S12, S21, S25 | done |
| A6 | S20 | not started |
| A7 | rows from the reconciled matrix | not started |
| — | S19, S23, S24 | no batch assigned; S23 and S24 are audits, S19 needs a definition of what a streak counts |

## What the code already has

Some of these were written from a partial look at the application, and
the code disagrees. These were checked directly, not taken from the
workbook:

- **S2** already done. `backend/app/api/routes/analytics.py` marks
  each part of the health score with `measurable`, and the response
  carries `has_enough_data` and `measured_parts`.
- **S3** already done. `backend/app/services/ai_advisor_service.py`
  has `MIN_TRANSACTIONS = 3` and a "data belum cukup" path.
- **S4** already correct. The default accent is `emerald`, not red.
- **S8** already clean. No Cyrillic anywhere in `frontend/src` or
  `backend/app`.
- **S16** already half done on the client. `Settings.jsx` asks for a
  confirmation word before deleting. The server side has no such check.
- **S22** already largely done. Seven calculator tabs exist, including
  tax (PPN) and loan (cicilan).
- **S17** partly done. Negative balances are stored, but nothing warns
  the reader about one, and there is no opening-balance question.

## A2: what was done

**S4, default accent not red.** Already correct. The default scheme
is `emerald`, in `frontend/src/utils/appearance.js` and in the backend
default. `rose` exists as a colour a user may choose; it is not the
default. No change needed, and none was made.

**S5, one PageHeader pattern.** New `frontend/src/components/ui/PageHeader.jsx`.
Adopted on Budgets, Goals and Debts. The header each of those pages
wrote is kept as the fallback, so with the switch off the pages are
byte-for-byte what they were. Other pages still have their own
headers; they were left alone to keep the change small.

**S15, sidebar profile card.** `frontend/src/components/layout/UserProfileSection.jsx`.
Two chip rows used `flex` without `flex-wrap`, so on a narrow sidebar
the chips were clipped instead of wrapping. Both rows now wrap, and
each chip holds its own line rather than being squeezed. The date also
used its own formatting; it now uses the shared `formatTanggal`. This
is a FIX: it is on by default, because the card was visibly broken.
The change also removed a crash: `identity.member_since` was read
without a check, and `identity` is not always present.

**S18, one icon family.** New `frontend/src/utils/icons.js` and
`frontend/src/components/ui/IconText.jsx`. The emoji were replaced
with the icon family the application already uses, on nine screens:
Dashboard, Shopping, ShoppingTracker, HealthCoach, MerchantMap,
MarketPage, Catalog, AddTransactionPage, AIAdvisor and Gmail Sync.
The emoji are still there when the switch is off.

### The switches

`frontend/src/utils/featureFlags.js` holds the switches. Each one is
off unless the build turns it on, so nothing changes for a reader
until a switch is deliberately turned on.

| Switch | How it is turned on | What it does |
|--------|--------------------|--------------|
| `UI_POLISH` | `VITE_UI_POLISH=1` at build time | The polish layer: the shared header, the icon family, the `data-ui="polish"` stylesheet |

The polish layer is `frontend/src/styles/polish.css`. Every rule in it
is written to apply only when the root element carries
`data-ui="polish"`, and that attribute is set only when the switch is
on. With the switch off, the rules match nothing.

### How this was checked

- The switch logic: `frontend/src/utils/__tests__/featureFlags.test.js`,
  20 assertions. A switch nobody has touched is off; a broken stored
  value is treated as off rather than as a crash.
- The build was run four ways and the environment object read out of
  the bundle each time: no `VITE_UI_POLISH` gives off, `"1"` gives on,
  `"0"` gives off.
- Every fallback in the pages was kept verbatim, so the switch-off
  page is the page that was there before.

## A3: what was done

**S6, Indonesian UI strings and consistent terms.** Two parts.

*One word for each thing.* The complaint was that the Indonesian
screen read as half-finished because English and Indonesian sat side
by side: "Budget" on one page and "Anggaran" on the next, "Edit"
here and "Ubah" there. A reader should not have to learn two words
for one thing. Where two words competed, the one the application
already used everywhere else won, so no preference was invented.
`frontend/src/i18n/__tests__/terminology.test.js` holds the 25
checks that stop a new page introducing a third word.

*The messages that only ever appeared in Indonesian.* Ten screens
read a message that was written in one language only, so an English
or Japanese reader saw Indonesian or English where the rest of the
page was in their own language. Each of those messages now has a
name in all three languages, in `frontend/src/i18n/keys_batch4.js`.

**S22, Indonesia-relevant calculators.** New tab on the calculators
page, behind the `UI_POLISH` switch, so with the switch off the page
is the page that was there before. Four calculators, because they
follow Indonesian law and Indonesian institutions rather than a
general rule:

- **PPh 21** — the income tax an employer withholds. The three rate
  tables of Lampiran PP 58/2023, the annual reckoning and the
  December month, and the daily rate.
- **PPN** — the sales tax, 11% on ordinary goods and 12% on luxury
  goods.
- **THR** — the religious holiday allowance: one month of wages after
  a year of service, and a share of it before that.
- **BPJS** — the health insurance, the old-age savings, the pension,
  the accident cover and the death benefit, with what comes out of
  the salary and what the employer adds.

The working out is on the server, in
`backend/app/services/calculation/indonesia.py`, because the rate
tables live there and change when the rules change. The browser does
not hold a copy of them. The endpoints are under
`/api/calculators/id/`, and they need no account and read and write
nothing.

### A note on the wording of the results

The server sends a code as well as a sentence wherever the sentence
would otherwise have been shown to the reader: the way the holiday
allowance was worked out, and the message for a failure. A sentence
written in one language cannot be put into another, so the code is
what the screen translates. The sentence is still sent, for a log or
a developer, and is what the screen falls back to when a code has no
name in the reader's language.

### How this was checked

- `backend/tests/unit/test_indonesia_calculations.py` — the worked
  examples from the rules themselves.
- `backend/tests/unit/test_indonesia_calculators_api.py` — that the
  endpoints are wired up and answer with those numbers, and that the
  calculators that were already there still answer.
- `backend/tests/unit/test_indonesia_calculator_language.py` — that
  the code arrives, and that a failure carries a code and a sentence.
- `backend/tests/unit/test_indonesia_calculator_locales.py` — that
  every code the server can send has a name in all three languages.
- The regression tests were shown to fail when the fix was taken
  out: removing `method_code` failed three checks, and putting the
  plain sentence back into the failures failed two more.
- The build was run with the switch on and with it off, and the
  bundle read to confirm the tab is present in one and absent in the
  other.

## A4: what was done

**S13, Gmail Sync states.** The Gmail page was reading a status the
server never sent, so it always fell through to the "not connected"
branch, and the reader could not tell which of three states the
connection was really in. The server now says which state it is in
(`backend/app/modules/integrations/email_parser/gmail_router.py`),
and the page shows that state.

Three things were broken behind this, and each was fixed:

- **The router did not exist.** `gmail_oauth.py` no longer had the
  `GmailService` class that `email_poller.py` and the package's
  `__init__.py` imported, so the whole package failed to import and
  the router was never registered. Every `/api/integrations/gmail/*`
  endpoint answered 404: the page was dead, not merely unclear.
- **The encryption could not run.** `KMSEncryption._derive_key` called
  `PBKDF2HMAC.verify()`, which checks a signature and always fails
  here, so every encryption raised "Keys do not match". It now calls
  `derive()`, which is what produces the key.
- **The credentials table was never created.** The model was not in
  the tables that get created, so the table was missing on a fresh
  install.

The server also says when the Google sign-in details are not set up,
rather than failing with a stack trace.

**S16, Delete All Data safeguards.** The client asked for a
confirmation word before deleting everything. The server did not.
Someone who called the endpoint directly deleted every row with no
check at all. The server now requires the same confirmation word.

### How this was checked

- `backend/tests/unit/test_gmail_integration.py` — that the package
  imports, the router is registered, a token is encrypted rather than
  merely encoded, a token stored the old way is still readable, the
  status reports the right state, and connecting without the Google
  details says so.
- The regression tests were shown to fail when the fixes were taken
  out.

## A5: what was done

Six items: S9, S10, S11, S12, S21, S25. Every one of them is behind a
reader switch, and every switch is off to begin with, so a reader who
has not asked for any of it sees exactly what they saw before.

**S9, sidebar grouping.** The flat list of twenty items was hard to
scan. `frontend/src/components/layout/navGroups.js` groups them into
five: money, plan, insight, tools, and the rest. The groups are drawn
by `GroupedNav.jsx`.

The groups live in a plain `.js` file rather than in the component, so
a script can check them without a browser. That is not tidiness for
its own sake: the groups name the items by key, and a key that does
not match the map of items is silently dropped, so a link goes missing
from the menu without a word of warning. That happened twice while
this was being written (`health-coach` for `healthCoach`, and
`category-expenses` for `categoryExpenses`), and
`frontend/src/components/layout/__tests__/navGrouping.test.js` now
fails if it happens again.

**S10, Merchant behind the advanced-features flag.** The merchant and
map pages are out of the menu until the advanced features are turned
on. Reaching one anyway — an old link, a bookmark — shows a page that
says what is going on and where to turn it on, rather than a blank
screen.

**S11, onboarding.** `frontend/src/components/dashboard/Onboarding.jsx`.
A new account is empty, so the first screen a reader sees is empty
charts. The setup walks through four steps — an account, a budget, the
recurring bills, the first transaction — and skips the ones the server
says are already done. It is a guide, not a gate: it can be closed at
any point and the reader can come back to it.

**S12, "this month" timeline.**
`frontend/src/components/dashboard/MonthTimeline.jsx` and the endpoint
`/api/dashboard/month-timeline`. The month is shown day by day, each
day with the money in, the money out and the difference. The endpoint
only counts the transactions that actually count: a pending
transaction is waiting in the review queue and a rejected one was
thrown away, so neither has moved the balance.

**S21, single add button.**
`frontend/src/components/common/SingleAddButton.jsx`. One button, in
the same place on every page that can add something. It sits above the
bottom navigation on a phone and in the corner on a bigger screen.

**S25, opt-in reminders.** The server works out what the reader should
be reminded about, in `backend/app/services/reminder_service.py`, and
the endpoint `/api/reminders/next` says so. Nothing is sent anywhere:
the reminder is shown by the browser on this device, and it stops the
moment the reader turns it off.

The reasons are looked at in the order a reader would think about them:
a bill that is due, a budget that has run out, a recurring bill that
has come round, and then the day itself — a day that has passed with
nothing recorded on it.

The server sends a code as well as a sentence, for the same reason as
everywhere else in this application: the sentence is written in one
language, so the code is what the screen translates.

### Two bugs found while this was being checked

Both were in the new code, and both are now covered by tests.

- **A recurring bill would have raised an error.** The service read
  `recurring.name`, but a recurring rule has a `description` and no
  `name` at all. Reaching that branch raised `AttributeError`.
- **A budget was judged by spending outside its period.** The spending
  was counted from the beginning of time, with no date filter and no
  category or account filter, so a category budget was judged by the
  whole of the reader's spending and a budget whose period had ended
  was still judged. The calculation now matches the budgets page, so
  the reminder and the page cannot disagree.

### The switches

Three more reader switches, all off to begin with and all stored in
the browser, so they belong to the device:

| Switch | What it does |
|--------|--------------|
| `NAV_V2` | The grouped sidebar |
| `SINGLE_ADD` | The one add button |
| `ADVANCED_FEATURES` | The merchant and map pages |
| `REMINDERS` | The reminders |

They are all turned on and off in one place, the display options panel
on the settings page (`frontend/src/components/settings/SwitchPanel.jsx`),
which also has a way to put them all back as they were.

### How this was checked

- `backend/tests/unit/test_reminders.py` — that a bill due within the
  window is worth a reminder, one that is not due is not, one that is
  paid off is not, a budget that has run out is, a budget is not judged
  by spending outside its period, a budget whose period has ended is
  not judged, a recurring bill that has come round is, a day with
  nothing recorded on it is, a day that was recorded is not, and the
  answer carries a code the screen can translate.
- `frontend/src/components/layout/__tests__/navGrouping.test.js` — 45
  checks that every item the groups name exists, that every item in
  the map is in a group, and that the advanced pages and the advanced
  group agree.
- The regression tests were shown to fail when the fixes were taken
  out: putting the wrong key back into the groups failed two checks.
- The build was run with the switch on and with it off, and the bundle
  read to confirm.

### One thing that was changed rather than added

The day of the week for the weekly reminder needed somewhere to live.
The obvious place — `reminder_days_before` — already meant "how many
days before a bill is due", and writing the day of the week into it
would have quietly changed what that setting meant. So the day of the
week has its own column, `reminder_day_of_week`, and the old setting
keeps its meaning.

