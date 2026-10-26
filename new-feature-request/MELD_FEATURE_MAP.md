# MELD UI/UX Feature Map (40 reference screenshots)

Source: `/Users/rafi/financial-manager/new-feature-request/meld-reference/` — 40 PNGs, all analyzed.
Note: 4 of the 40 (`2026-10-20 at 07.38.39/46`, `07.39.39`, `07.39.44`) are **Etsy listings for a "Digital Purchase Tracker" spreadsheet**, not MELD app screens. They are excluded from the MELD IA map but noted below as inspiration.

App under reference: **MELD** (`meld.my.id`) — Indonesian personal/household finance PWA.
Tagline: *"Master your money, Together."* User: Tanaka Haruka. Account: "Keuangan Tanaka".

---

## 1. Global app shell (appears in every MELD screenshot)

Persistent **left sidebar**, fixed order:
1. MELD logo + tagline
2. `Setup` button (green)
3. Account/workspace switcher — "Keuangan Tan…" + chevron
4. User name (Tanaka Haruka)
5. **"Lengkapi Profil Keuangan…"** — profile-completion CTA with wallet icon + chevron
6. **"Upgrade ke Pro"** — orange→pink gradient button, crown + sparkle
7. **Kebun Meld** — reward garden, badge **"6 HADIAH"** (earlier captures show "3 HADIAH")
8. `Household` — "Orang, uang bersama, dan aturannya"
9. `Beranda` (dashboard) · `Transaksi` · `Komunitas` (red notification dot) · `Kategori`
   - Alternate sidebar set seen on `/plan`, `/charts`, `/settings`: `Rencana`, `Grafik` (**NEW** badge), `Langganan`, `FP Services` (**SOON**), `Meldfiliate` (**NEW**), `Bot Add-ons` (**NEW**), `Pengaturan`
10. `Install MELD` (blue, download icon) — PWA install
11. `Keluar` (logout)

Top header (right side): household name + dropdown chevron, theme toggle (moon/sun), help `?`, notification bell, avatar.
Bottom-right: **blue circular FAB "+"** on nearly every page.

Persistent visual conventions:
- Color-coded semantic actions: **green** = setup/CTA, **blue** = primary/create, **orange→pink gradient** = Pro upsell, **red dot** = unread, **purple/blue/green** = budget jar segments.
- Status badges in nav: `NEW`, `SOON`, `Pro`, `Hanya di aplikasi`, `Android NEW`.
- All money formatted as `Rp` / `Rp6 jt` / `Rp500.0K/hari`.

---

## 2. Page-by-page map

### A. Beranda / Dashboard — `meld.my.id`
Not captured in a full-screen state, but visible via sidebar + FAB.

### B. Perencanaan Keuangan (`/plan`)
Educational landing that teaches before it configures.
Order:
1. Title "Perencanaan Keuangan" + subtitle "Kontrol keuanganmu pake anggaran dan target tabungan"
2. **"Inspirasi Hari Ini"** card — daily quote + attribution (Benjamin Franklin)
3. Two parallel cards:
   - **Anggaran** — "Pantau batas pengeluaranmu biar gak kebablasan", bullets: track every expense / review weekly / **50/30/20 rule**, CTA "Kelola Anggaran →"
   - **Target Tabungan** — "Set specific, measurable savings goals", bullets: automate savings / "start small - even $10 a week adds up", CTA "Kelola Target →"
4. **"Kenapa Harus Rencana Keuangan?"** — a 3-stat KPI row: **80%** feel more in control · **3-6x** more likely to hit targets · **65%** less financial stress
5. FAB +

Patterns: motivational quote card, education-before-config cards, statistic justification row, persona-naming.

### C. Anggaran / Budget — `meld.my.id/budgets`
**Two distinct surfaces:**

**C1. Smart Budget wizard (5 steps)** — modal-ish panel, `Langkah N dari 5` + icon step tracker (envelope → sort → document → target → check).
- **Step 1 "Gaji"** — "Berapa yang masuk tiap bulan?", envelope illustration, **Rp 0**, label "GAJI BERSIH SEBULAN", helper "Gaji bersih setelah potongan. Kira-kira juga boleh, nanti bisa diubah dari kartu Smart Budget.", empty-state note "Belum ada sumber pemasukan atau transaksi masuk…", CTA **"Lanjut ke sortir"**
- **Step 2 "Sortir"** — three jar summary cards: **Kebutuhan 4 kategori** / **Keinginan 2 kategori** / **Bukan belanja 1 kategori**; "Belum masuk toples · 2" section (Transportasi, Makan) with "Sekarang ketuk toples tujuannya"; **search field "Cari kategori"**; "SUDAH DI TOPLES" with badge **"7 diteba"**; CTA "Lanjut ke bagi >"
- **Step 3 "Bagi"** — **segmented allocation slider** with scale 0/25/50/75/100%: Kebutuhan 50% **Rp3.000.000** (blue) · Keinginan 30% **Rp1.800.000** (purple) + "Sekitar Rp60 rb per hari" · Tabungan 20% **Rp1.200.000** (green) + "Mengalir ke Dana Darurat". Total **Rp6.000.000**. Below: **"RESEP"** preset cards — **Si Seimbang 50/30/20**, **Si Pejuang Cuan 40/20/40**, **Si Anak Kota 60/20/20**, **Si Pelunas 50/20/30**. CTA "Lanjut ke target >"
- **Step 4 "Target"** — empty state "Kamu belum punya target tabungan. Dana darurat biasanya jadi yang pertama." + quick choices "Target baru (Dibuat otomatis)" / "Belum ada (Tabungan umum)"; **projection line chart 2027–2029** with target node "15 bln", "Jan 2028", "1 thn 3 bln lagi", type "Dana Darurat"; **JENIS TARGET** chips: Dana darurat / Liburan / Rumah / Bikin sendiri; derivation copy "Enam kali kebutuhan sebulan: Rp18.000.000"

**C2. Active budget view (post-setup)**
- Month nav: **Oktober 2026**, "Oct 1 – Oct 31 · berjalan", ← → arrows
- **Smart Budget card**: "Rp6 jt/bln · 6 hari lagi", pencil + **50/30/20** badge, envelope icon with red badge **1**
- **Three jar illustration** (blue / purple / grey w/ pixel-art cat) + per-jar summary: Kebutuhan **Rp3 jt** / **Rp500.0K/hari** · Keinginan **Rp1,8 jt** / **Rp300.0K/hari** · Tabungan **Rp0** dari **Rp1,2 jt**
- Status line: "…posisi aman hari ini"
- Button "Sembunyikan Smart Budget"

Patterns: 50/30/20 slider, "resep" persona presets, jar metaphor, daily burn-rate translation (Rp/hari), "posisi aman" status line, per-period month navigation, progress via remaining days.

### D. Grafik / Charts — `meld.my.id/charts` (badge **NEW**)
Three analytic cards + FAB:
1. **Weekly Expenses** — period "26 Oct - 1 Nov 2026", Total **Rp0**, Daily Avg **Rp0**, mini 7-bar chart (Sen–Min)
2. **Income vs Expenses** — empty state **"No data yet"**
3. **Net Balance Trend** — "Cumulative over time" line chart

Patterns: card-per-metric with embedded mini-chart, explicit "No data yet" empty state, cumulative net-balance trend.

### E. Kategori — `meld.my.id/categories`
1. Heading "Kategori" + summary **"9 kategori · 6 belum ditempel"**
2. Tabs **Keluar / Masuk** (Masuk selected)
3. Search bar
4. **"Rp0 keluar bulan ini"** + empty bar-chart placeholder
5. **"Belum ditempel"** section — "Belum dihitung Smart Budget. Ketuk untuk memilih kelompok." with 6 icon buttons (Belanja Harian, Hiburan, Kesehatan, Makan, Penyesuaian Saldo, Transportasi)
6. Grouped sections: **Kebutuhan** (Sewa/Kos, Tagihan Listrik/Air), **Keinginan**

Patterns: count-summary header ("9 kategori · 6 belum ditempel"), income/expense tab split, unattached-to-budget empty group with tap-to-assign.

### F. Langganan / Subscriptions — `meld.my.id/subscriptions`
**Add Subscription modal**, one long scroll:
1. Header "Add Subscription" + search icon + ⋮ overflow + X
2. **Service** icon grid (Netflix, YouTube Premium, Spotify, HBO Max, Amazon Prime, Apple TV+, Disney+, Hulu, Paramount+, Peacock, Crunchyroll, Twitch / Dropbox, iCloud+, Microsoft 365, Adobe CC, GitHub, ChatGPT Plus, Canva Pro, Zoom, **Other**)
3. **Custom logo** — "Optional. The whole logo is fitted to the center automatically. Pick Fill to crop it to a square instead." + Upload logo + preview tile (initials fallback)
4. **Subscription Name**, **Amount** (0)
5. **Billing Cycle** segmented: Monthly / Yearly / Custom
6. **Billing Day** — full 1–31 calendar grid, day **26** selected, confirmation "Your subscription renews on the 26th of each month"
7. **Remind me before** — preset chips 1d/2d/3d/5d/7d (**3d** selected) + custom number field ("Custom days before due (0 = on the day)")
8. **Auto-debit** — "Automatically create an expense on each billing date" + 🔒 **Pro** badge
9. **Next billing date** — "Monday, October 26, 2026"
10. Footer: Cancel / Add Subscription

Patterns: **recurring subscription tracking with renewal day, reminder lead-time presets, auto-debit auto-create expense (Pro)**, brand-logo picker grid, custom-logo upload, next-billing-date preview.

### G. Household — `meld.my.id/household`
Shared household space with **6 internal tabs**: Ringkasan · Agenda · Tugas · Kebutuhan · Target · Catatan.
- Header: "1 anggota", date "Senin, 26 Oktober 2026", green "+ Tambah"
- **KODE UNDANGAN** card — code `76B63290` + "Salin" button + "Bagikan ke pasangan atau keluarga biar bisa catat bareng."
- **Agenda** tab: horizontal date filter (Semua, Sen 26 … Rab 4), "Lihat agenda yang sudah lewat", event card "Rapat mingguan tim" / OKT 29 / Kam / 19.00 / "Rumah Nenek"
- **Kebutuhan** tab: "Kebutuhan tim" list w/ check circles (Berasa 5 kg, Telur, Sabun cuci), count **3 / 3**, status "BELUM DIBELI"; empty-state panel "CONTOH TAMPILAN" — "Belum ada kebutuhan. Kebutuhan operasional." + "+ Tambah kebutuhan" + "Mencentang barang tidak membuat transaksi. Catat nominal struk saat pembelian benar-benar terjadi."

Patterns: invite-code collaboration, household tabs, shared shopping list as checklist, agenda with date strip filter, explicit warning that checking an item ≠ creating a transaction.

### H. Profil Keuangan — `meld.my.id/financial-profile`
Chapter-based page, "Geser untuk pindah bab" (swipe between chapters), icon strip: calendar / wallet / chart / house / credit-card / Rp / Rp / envelope.
- **Rekening** chapter: "Total saldo **-Rp140.000**", "1 rekening dan dompet", CTA "+ Tambah rekening"; **Tunai** section with card "Cash" / "Bersama, Tunai" / badges **Utama** + **Terkunci** / -Rp140 rb
- **Investasi** chapter: "Nilai investasi **Rp0**", "Belum ada investasi", decorative rising bar illustration, copy "Saham, emas, kripto, atau reksa dana. Harganya bisa diperbarui sekali ketuk.", CTAs "+ Catat" / "+ Tambah investasi"
- **Utang** chapter: "Sisa utang **Rp0**", "Tidak ada utang aktif", copy "Utang yang kamu catat tampil sebagai jalan menuju lunas, lengkap dengan perkiraan tanggalnya.", large empty illustration, CTAs "+ Catat" / "+ Catat utang"
- **Piutang** chapter: "Piutang aktif **Rp0**", "Belum ada yang berutang padamu", copy "Catat uang yang kamu pinjamkan supaya tidak lupa menagih. **Piutang tidak ikut net worth sampai kamu menyalakannya.**", big Rp coin + checkmark illustration, "+ Catat" / "Catat piutang"
- **Aset fisik** chapter: "Nilai aset fisik", **Khusus Pro**, "Mobil, rumah, dan barang koleksi", card grid, "+ Catat"
- **CATAT modal** — the unified capture picker, grouped by relationship to money:
  - **YANG KAMU PUNYA**: Rekening, Investasi, Aset fisik
  - **YANG HARUS KAMU BAYAR**: Kartu kredit, Utang
  - **YANG AKAN MASUK**: Piutang
  - Each row = icon + title + one-line explainer + chevron
- **Pemasukan Baru modal**: type chips (Gaji/Freelance/Usaha/Bonus/Sewa/Lainnya) → Nama ("mis. Gaji Budi") → "Nominal tiap bulan" Rp0 with quick chips **× ribu / × juta / +500rb** → Frequency (Mingguan / 2 minggu / Bulanan / Tahunan) → **12-month schedule strip** (J F M A M J J A S O N D with dots) → "Setahun ada 12 kali pemasukan. Total bulanan dihitung dari nominalnya langsung." → **Setor otomatis** toggle + "Lihat Pro" → "Simpan pemasukan"

Patterns: **net-worth built from chapters (assets/liabilities/income)**, three-way user-centric taxonomy, receivables excluded until activated, physical-asset Pro tier, 12-month recurring schedule, quick amount-entry chips, "Setor otomatis" recurring income auto-record.

### I. Pengaturan / Settings — `meld.my.id/settings`
1. Title "Pengaturan" + "Atur Meld sesuai caramu"
2. **Settings search**: "Cari: tema, PIN, mata uang…"
3. **PASPOR MELD** — avatar initials TH, name, email, **"1 dari 67 lencana"**, **15 poin**, "Lencana >" drill-down, edit pencil
4. **Kesiapan akun** (account readiness) — pixel-art blue cat mascot, **"Berikutnya: Izinkan pengingat harian."**, note "Buka PIN, sidik jari, dan auto-lock ada di aplikasi, jadi tidak ikut dihitung di web.", horizontal progress bar (no % shown)
5. **Pencatatan otomatis** card — lightning icon, green badge **4**, "Biar Meld yang mengetik, kamu cukup memeriksa", 3-step pipeline diagram: **Struk atau notifikasi → Meld membaca → Draft untuk dicek**
6. **MELD Copilot** — badges **Pro** + **Hanya di aplikasi**, "Catat lewat share struk"
7. **Auto-catat notifikasi** — badges **Pro** + **Android NEW**, "Membaca notifikasi bank dan e-wallet"
8. **Notifikasi** section — "Pengingat harian" toggle, peach warning **"Izin notifikasi belum diberikan. Pengingat tidak akan sampai."** + button **"Izinkan notifikasi"**, "Notifikasi push" (**Pro**)
9. **Household** section — "Keuangan Tanaka", meta **"IDR · 1 anggota · kamu admin"**, TH avatar, chevron
10. **Ruang bersama** page — "Atur jenis dan fitur" (chevron row), "Nama household" input, "Mata uang" = **Rp IDR**, **"Bulan keuanganmu"** dual-handle month ruler slider (blue + orange markers, "Siklus mulai tgl 1" / "Potret tgl 1"), callout "Laporan bulanan berjalan tgl 1 sampai tgl 31 · Net worth dibekukan ke riwayat tiap tgl 1" + "Biasanya tanggal gajian… Angka yang tersimpan dikunci untuk bulan itu, jadi kemajuanmu kelihatan apa adanya."
11. **Hak akses** (**Pro**) — "Siapa boleh apa. Admin selalu boleh semua." empty state "Belum ada anggota lain…"
12. **Aset pribadi** (**Pro**) — permission link row
13. **Household lain** — "Buat baru" (**Pro**) / "Gabung dengan kode"
14. Display prefs — transaction button style **Melayang / Menyatu**, "Mode Ringan" toggle
15. **Import modal "Bawa data masuk"** — "Pilih file" + "Atau lepas file di sini", 4 supported formats (Meld .xlsx export / Money Manager .xls-xlsx / custom CSV with `(+)`Income `(-)`Expense `(*)`Transfer / free CSV-Excel with auto-detected column aliases Date|Tanggal, Amount|Value|Nilai|Jumlah, Type, Category, Sub-Category, Notes, Account|From/To Account), batch import with visible progress, non-destructive
16. **Video Tutorials modal** — "Search tutorials…", featured **"SERI VIDEO • SEASON 1 — Boss Keuangan"** ("10 boss keuangan, satu per satu"), cards (Kalkulator Transaksi, Networth, Link kategori dan label), progress **0/31**

Patterns: settings-wide search, **readiness checklist with mascot + "next step"**, passport badge/points gamification, **auto-capture pipeline diagram**, Pro lock badges, inline permission-blocking warning with fix CTA, dual-handle month-cycle slider, import wizard with column-alias mapping.

### J. Add-ons / Pro paywall — `meld.my.id/addons`
Centered **"Fitur MELD Pro"** modal — features with 🔒 each: **Catat via Telegram**, **Voice Note**, **Scan Struk**, **AI Otomatis** (detects category, amount, type), **Cek Saldo & Laporan**. CTA "Upgrade ke Pro".

### K. Meldfiliate / referral program — `meld.my.id/meldfiliate`
Hero "Join MELD Creator Program", benefit chips **Verified Badge / Custom Landing / Revenue Share**, CTA "Daftar sebagai Creator >", **KODE REFERRAL KAMU `T-9649`** + Salin Kode / Salin Link / Bagikan, terms "diskon 10% Pro Tahunan (berlaku 30 hari)".
Detail tab: tabs **Total Referral / Pending / Sudah Dicairkan**; "Cairkan Komisi" card — **Minimum pencairan Rp100.000**, button "Ajukan Pencairan"; numbered **"Cara Kerja Meldifiliate" 4 steps** (Bagikan kodemu → Teman daftar = **Rp100** → Teman beli Pro Tahunan = **Rp10.000** → Cairkan komisimu ≥ **Rp100.000**); summary cards "Rp100 per teman daftar" / "Rp10.000 saat teman beli Pro Tahunan"; **Riwayat Komisi (0)** / **Pencairan (0)**.

---

## 3. Consolidated answers to the specific questions

| Question | Answer |
|---|---|
| **"Pencatatan otomatis" auto-capture inbox / drafts?** | **Yes — partially.** Settings has a **"Pencatatan otomatis"** card with badge **4** and a 3-step pipeline **"Struk atau notifikasi → Meld membaca → Draft untuk dicek"**. The Pro add-ons paywall adds **Scan Struk**, **Voice Note**, **AI Otomatis**, **Catat via Telegram**, plus **MELD Copilot** ("Catat lewat share struk", Pro, app-only) and **Auto-catat notifikasi** ("Membaca notifikasi bank dan e-wallet", Pro, Android NEW). So a *draft-to-review* concept exists, but **no dedicated drafts inbox screen was captured** — it is described, not shown as a queue/list UI. |
| **Setup / readiness checklists?** | **Yes, two distinct ones.** (1) **"Kesiapan akun"** card with pixel-art cat mascot, a horizontal progress bar, and a *"Berikutnya: Izinkan pengingat harian"* next-action line. (2) **"Lengkapi Profil Keuangan…"** persistent sidebar CTA. (3) The **5-step Smart Budget wizard** with `Langkah N dari 5` + icon step tracker, each step with an empty state and a forward CTA. (4) Settings' **PASPOR MELD**: *"1 dari 67 lencana"*, *15 poin*, drill-down to badges. |
| **Budget wizard / "recipe" concept?** | **Yes — both.** 5-step wizard, and the **"RESEP"** section with 4 persona-named budget recipes: **Si Seimbang 50/30/20**, **Si Pejuang Cuan 40/20/40**, **Si Anak Kota 60/20/20**, **Si Pelunas 50/20/30**. Recipes drive a **segmented 50/30/20 allocation slider** (0–100%) that shows rupiah per segment and derived daily burn ("Sekitar Rp60 rb per hari"). |
| **Net worth / asset-liability breakdown?** | **Yes.** Financial-profile chapters: **Rekening** (Total saldo -Rp140.000, "1 rekening dan dompet"), **Investasi** (Nilai investasi Rp0 — saham/emas/kripto/reksa dana), **Aset fisik** (Pro — mobil/rumah/koleksi), **Kartu kredit**, **Utang** (Sisa utang, "jalan menuju lunas" with estimated payoff date), **Piutang** (excluded from net worth until activated). Unified **"CATAT" picker** groups items as **YANG KAMU PUNYA / YANG HARUS KAMU BAYAR / YANG AKAN MASUK**. Monthly cycle is user-set (dual-handle month ruler) and **net worth is frozen to history on the 1st** so progress is honest. |
| **Daily cash limit concept?** | **Not as a named feature, but the mechanic exists.** The Smart Budget card converts each jar into a per-day allowance: **Kebutuhan Rp500.0K/hari**, **Ke中国家an Rp300.0K/hari**, plus a "posisi aman hari ini" status line and "6 hari lagi" remaining-period indicator. There is **no standalone "daily cash limit" page/screen** — it is a derived readout inside the budget card. |
| **Recurring subscription tracking?** | **Yes, explicitly.** `Langganan` page + Add Subscription modal: brand-icon service picker (20+ services), custom logo upload, **billing cycle** (Monthly/Yearly/Custom), **billing day** 1–31 calendar, **remind me before** presets 1d/2d/3d/5d/7d + custom, **auto-debit** ("Automatically create an expense on each billing date", Pro), **next billing date** preview. Also recurring **income** ("Setor otomatis", 12-month schedule) and recurring **expenses** via household agenda. |

---

## 4. 15 most distinctive UI patterns worth copying

1. **"RESEP" persona budget presets** — name budget ratios after archetypes (Si Seimbang / Si Pejuang Cuan / Si Anak Kota / Si Pelunas) with the ratio printed on the card; tapping one instantly re-slides the allocation. Turns a dry 50/30/20 slider into a personality picker.
2. **Three-jar 50/30/20 allocation slider + jar illustration** — a draggable segmented bar (0/25/50/75/100%) where each segment shows %, rupiah, and a purpose annotation ("Mengalir ke Dana Darurat"). The jar/coin visual carries the metaphor; a pixel-art cat lives in the savings jar.
3. **Derived daily burn-rate readout** — show `Rp500.0K/hari` next to each bucket, plus "posisi aman hari ini" and "N hari lagi". Converts a monthly budget into an actionable per-day number.
4. **Readiness card with mascot + "Berikutnya:" next action** — "Kesiapan akun" with an illustrated mascot, a horizontal progress bar, and one concrete next step ("Izinkan pengingat harian"), rather than a long checkbox list. Keep the pin/fingerprint carve-out note.
5. **Auto-capture pipeline diagram** — "Struk atau notifikasi → Meld membaca → Draft untuk dicek" as a 3-arrow diagram on the auto-capture settings card. Communicates the trust model of AI capture without a screenshot.
6. **Unified "CATAT" record-type picker grouped by relationship to money** — **YANG KAMU PUNYA / YANG HARUS KAMU BAYAR / YANG AKAN MASUK**, each row = icon + title + one-line explainer + chevron. A far better capture-menu IA than a flat type dropdown.
7. **Chaptered financial profile with swipe navigation** — calendar/wallet/chart/house/credit-card/Rp/envelope icon strip with "Geser untuk pindah bab", each chapter owning one asset class with its own summary card + empty state + two CTAs (+ Catat / + Tambah X).
8. **Illustration-led empty states with two parallel CTAs** — big custom illustration (Rp coin + green check, rising bar chart, pixel mascot) + "Belum ada X" headline + explanation of what the feature will do + "+ Catat" and "+ Tambah investasi" buttons. Never a bare empty table.
9. **Rupiah quick-entry chips** — `× ribu`, `× juta`, `+500rb` under any nominal field, plus an inline `Rp` prefix. Removes the worst friction in IDR data entry.
10. **Month-cycle dual-handle ruler slider** — set "Siklus mulai tgl 1" and "Potret tgl 1" on a month ruler, with a callout explaining the consequence: *"Laporan bulanan berjalan tgl 1 sampai tgl 31. Net worth dibekukan ke riwayat tiap tgl 1… Angka yang tersimpan dikunci untuk bulan itu, jadi kemajuanmu kelihat apa adanya."* Explicitly teaches why the setting exists.
11. **Subscription renewal-day calendar + reminder lead-time presets** — full 1–31 day grid with a live sentence ("Your subscription renews on the 26th of each month"), 1d/2d/3d/5d/7d chips + custom days, and **Auto-debit** that auto-creates the expense on each billing date (Pro).
12. **Brand-logo service picker grid + custom logo upload** — pick from ~20 recognizable subscription brands by icon, or upload your own with automatic "Fit"/"Fill" handling and an initials-fallback preview tile. Zero typing to add Netflix or iCloud+.
13. **Classification-by-tapping "jars"** — "Belum masuk toples · 2" list of unassigned categories with a live search ("Cari kategori"), "SUDAH DI TOPLES · 7 diteba" counter, and tap-a-category-to-assign-to-a-jar. The Categories page mirrors it with "9 kategori · 6 belum ditempel" + a "Belum ditempel" group.
14. **Settings-wide search with topical placeholder** — "Cari: tema, PIN, mata uang…" as the first element of the Settings page, so long settings lists stay navigable.
15. **Gamification: Passport + reward garden + video-season progression** — "PASPOR MELD" with **1 dari 67 lencana** and **15 poin**, a "Kebun Meld" nav item with a **"6 HADIAH"** badge, red unread dots, and a **Video Tutorials** center with a featured **"SERI VIDEO · SEASON 1 — Boss Keuangan"** series and a **0/31** completion counter.

Runners-up worth stealing: numbered 4-step explainer ("Cara Kerja Meldifiliate"), 3-stat "why this matters" KPI row (80% / 3-6x / 65%), daily quote card ("Inspirasi Hari Ini"), household invite code + "Salin", inline permission-blocking warning with a fix button, import wizard with column-alias auto-mapping, and the "Net worth dibekukan tiap tgl 1" honesty mechanism.

---

## 5. Gaps vs. our app (`/Users/rafi/financial-manager`)

Our frontend pages: `Dashboard, Transactions, Budgets, Goals, Debts, Accounts, Recurring, Analytics, CategoryExpenses, Calculators, HealthCoach, AIAdvisor, MerchantManager/Map, MarketPage, CatalogPage, Shopping*, ProfileSummary, Settings/, GmailIntegration, Feed/`.

Likely missing / weaker in our app, in priority order:

| Gap | MELD reference to copy |
|---|---|
| **No budget recipe presets / persona-named ratios** | Si Seimbang / Pejuang Cuan / Anak Kota / Pelunas cards + allocation slider |
| **No per-day burn rate or "posisi aman" status** | Rp500.0K/hari per bucket, days-left, safe-position line |
| **No readiness checklist / next-step card** | "Kesiapan akun" + mascot + "Berikutnya: …" + progress bar |
| **No auto-capture draft pipeline UI** | Struk/Notifikasi → Meld membaca → Draft untuk dicek; Copilot & Auto-catat notifikasi cards |
| **No subscription tracking module** (we have `Recurring` for expenses, but not service logos / renewal day / remind-before / auto-debit) | Full `Langganan` page + Add Subscription modal |
| **No net-worth chapter model** (accounts/investments/physical assets/credit cards/debt/receivables) | Profil Keuangan chapters + "CATAT" 3-group picker + receivables-excluded-until-activated |
| **No household/shared-space module** | Household tabs, invite code, shared needs checklist, agenda date strip |
| **No gamification layer** | Passport badges (1/67, 15 poin), Kebun Meld (6 HADIAH), tutorial seasons (0/31) |
| **No per-category drill-down from charts** | Weekly Expenses / Income vs Expenses / Net Balance Trend cards with "No data yet" states |
| **No import wizard with column-alias mapping** | "Bawa data masuk" 4-format support list, batch progress, non-destructive guarantee |
| **No settings-wide search** | "Cari: tema, PIN, mata uang…" |
| **No month-cycle / payday setting that freezes net worth history** | Dual-handle month ruler + "net worth dibekukan tiap tgl 1" |

*Etsy reference (4 shots) also suggested a **Kanban status board** (To Buy → Purchased → Onboarded → Accessed → Access Issue → In Progress → Paused → Completed → Canceled → Expired) as a lifecycle view for purchases/subscriptions — a plausible extension of our `ShoppingBoard`.*
