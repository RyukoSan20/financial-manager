# A7: the rows from the reconciled matrix

The reconciled matrix has 82 rows. Thirty-six of them were found to
be genuinely missing when the code was checked against each one. This
file records which of those thirty-six belong to A7, and which do not.

The rule for the decision:

- **In.** Buildable inside this application, with the data already
  here. No new platform, no other company, no business decision, no
  regulated boundary.
- **Out.** Needs something this application does not have: a phone
  app, a bot on another service, a household with several people in
  it, a paid plan, a community to moderate, or video to produce.

The matrix is evidence, not instructions. Every row below was
checked in the code before this list was written. The ones that
turned out to exist are not here, because there was nothing to do
about them.

## In scope (18)

| Row | Feature | Priority | Needs |
|-----|---------|----------|-------|
| 2 | Calculator in the amount field | Sedang | New file |
| 6 | Several transactions in one sentence | Sedang | New file |
| 21 | Indonesian bank and e-wallet logos | Sedang | New file |
| 24 | A balance-adjustment category | Sedang | Migration |
| 25 | Labels and tags | Rendah | Migration |
| 27 | Picking categories on the first run | Tinggi | New file |
| 32 | Auto-debit on the billing date | Sedang | Migration |
| 33 | Auto-payday, income added by itself | Sedang | Migration |
| 36 | Money owed and money owed to you | Tinggi | Migration |
| 38 | The 50/30/20 budget as a recipe | Sedang | New file |
| 40 | The start of the budget period | Tinggi | Migration |
| 63 | A page saying what leaves the device | Tinggi | New file |
| 76 | A reference price to compare against | Sedang | Migration |
| 77 | A monthly shopping suggestion | Tinggi | New file |
| 79 | A calendar feed | Tinggi | New file |
| 80 | A money calendar, the daily balance ahead | Sedang | New file |
| 81 | Detecting a bill paid twice | Sedang | New file |
| 82 | Detecting a subscription that was forgotten | Sedang | New file |

Eight need a new column or a new table. Those are written as
migrations that are **not** run: the owner reads them and runs them.
Six are new files with no change to the shape of any data at all.
Four are changes to a page, and those go behind a switch that is off
by default.

## Out of scope (18)

| Row | Feature | Why not |
|-----|---------|---------|
| 8 | Share a receipt from another app | Needs a share target in another application |
| 12 | Record through a Telegram bot | Needs a bot on another service |
| 13 | Record through WhatsApp | Needs an intake on another service |
| 50 | A shared space for a couple or a family | A household is a large architectural change, and the expansion document puts it after the single-user product is solid |
| 51 | An invitation code | The household model |
| 52 | What each member may do | The household model |
| 53 | A note when a member records something | The household model |
| 54 | A shared diary | The household model |
| 55 | Shared tasks, targets and notes | The household model |
| 57 | Sharing a budget or transaction template | The household model |
| 58 | A community | Needs a moderation and hosting plan, and it is another organisation |
| 61 | Processing the text on the device | A change of platform, not a feature |
| 64 | An Android application | Needs an Android application |
| 65 | An iOS application | Needs an iOS application |
| 71 | A video course | Needs video to be produced |
| 72 | A paid Pro plan | A business decision, not an engineering one |
| 73 | A referral programme | A business decision |
| 74 | Social media content | Another company |

The expansion document, section 1.4, rules out of the next twelve
months: being a bank, giving licensed investment advice, filing tax
returns, aggregating bank accounts worldwide, and splitting the
monolith into microservices. None of the eighteen above crosses those
lines; they are out of scope for the ordinary reason, which is that
they are not this application.

The expansion document, section 1.5, puts the personal Indonesian
reader first, the small merchant second behind a switch, the household
third and only after the single-reader data is properly isolated, and
a business API last and only against a real request. The household
rows are out of scope for exactly that reason.

## What this batch does not touch

- No page is rewritten.
- No export, prop, route, response shape or column meaning changes.
- No data is moved and no existing value is rewritten.
- The migrations are written and left for the owner to run.
- No new dependency is added.
