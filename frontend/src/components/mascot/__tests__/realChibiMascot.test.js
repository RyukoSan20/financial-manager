/**
 * The real chibi artwork, the draggable companion, and the four pages
 * that were rebuilt around it.
 *
 * Run with:
 *   node src/components/mascot/__tests__/realChibiMascot.test.js
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, '../../../..');
const ROOT = path.resolve(FRONTEND, '..');
const read = (p) => fs.readFileSync(path.join(FRONTEND, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(FRONTEND, p));

let passed = 0;
let failed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`not ok - ${name}`);
    console.log(`  ${err.message}`);
  }
};

const CAST = ['koneko', 'minori', 'kaneru', 'kogane', 'mone', 'zenimaru'];
const POSES = ['happy', 'walking', 'sweating', 'thinking'];

/* --- the assets ------------------------------------------------------ */

await check('the sync script is there and reads the real asset folders', () => {
  const script = fs.readFileSync(path.join(ROOT, 'scripts/sync_real_chibi_assets.py'), 'utf8');
  for (const folder of ['"chara"', '"motion"', '"places"']) assert.ok(script.includes(folder), folder);
  assert.ok(/def strip_outer_white/.test(script), 'the outer-white flood');
  assert.ok(/def crop_face/.test(script), 'the 1:1 face crop');
});

await check('every character has a transparent sticker, a face and four poses', () => {
  for (const id of CAST) {
    assert.ok(exists(`public/koban-assets/chara/${id}.png`), `chara/${id}.png`);
    assert.ok(exists(`public/koban-assets/chara/${id}.webp`), `chara/${id}.webp`);
    assert.ok(exists(`public/koban-assets/face/${id}.png`), `face/${id}.png`);
    assert.ok(exists(`public/koban-assets/face/${id}.webp`), `face/${id}.webp`);
    for (const pose of POSES) {
      assert.ok(exists(`public/koban-assets/motion/${id}_${pose}.webp`), `motion/${id}_${pose}.webp`);
    }
  }
});

await check('the shipped artwork is sized for a browser, not for print', () => {
  // The sources are 1792x2400 and ~4 MB each. Shipped at that size a
  // single page with six companions pulled 25 MB.
  for (const id of CAST) {
    const sticker = fs.statSync(path.join(FRONTEND, `public/koban-assets/chara/${id}.webp`)).size;
    assert.ok(sticker < 200 * 1024, `chara/${id}.webp is ${Math.round(sticker / 1024)} KB`);
    for (const pose of POSES) {
      const size = fs.statSync(path.join(FRONTEND, `public/koban-assets/motion/${id}_${pose}.webp`)).size;
      assert.ok(size < 120 * 1024, `motion/${id}_${pose}.webp is ${Math.round(size / 1024)} KB`);
    }
  }
});

await check('the motion poses and the sticker are transparent, not white boxes', () => {
  // A PNG with an alpha channel is colour type 6; a WebP with alpha
  // carries the ALPH chunk or the alpha bit of VP8X.
  for (const id of CAST) {
    const png = fs.readFileSync(path.join(FRONTEND, `public/koban-assets/chara/${id}.png`));
    assert.equal(png[25], 6, `chara/${id}.png has no alpha channel`);
    const webp = fs.readFileSync(path.join(FRONTEND, `public/koban-assets/motion/${id}_happy.webp`));
    const head = webp.subarray(0, 64).toString('latin1');
    const vp8x = head.indexOf('VP8X');
    const alpha = head.includes('ALPH') || (vp8x >= 0 && (webp[vp8x + 8] & 0x10) !== 0) || head.includes('VP8L');
    assert.ok(alpha, `motion/${id}_happy.webp has no alpha`);
  }
});

/* --- the companion --------------------------------------------------- */

const drag = read('src/components/mascot/DraggableSparkleMascot.jsx');

await check('the companion is dragged with pointer events, on the transform', () => {
  for (const handler of ['onPointerDown', 'onPointerMove', 'onPointerUp', 'onPointerCancel']) {
    assert.ok(drag.includes(handler), handler);
  }
  assert.ok(drag.includes('setPointerCapture'), 'the drag survives leaving the figure');
  assert.ok(/translate3d\(\$\{offset\.x\}px, \$\{offset\.y\}px, 0\) rotate\(\$\{tilt\}deg\)/.test(drag), 'the transform');
  assert.ok(drag.includes("touchAction: 'none'"), 'touch-action none');
  assert.ok(drag.includes('cursor-grab') && drag.includes('cursor-grabbing'), 'the grab cursors');
});

await check('a drag leaves a trail and a release throws confetti', () => {
  assert.ok(/TRAIL_KINDS = \['glint', 'star', 'koban'\]/.test(drag), 'glints, stars and koban');
  assert.ok(drag.includes('event.clientX') && drag.includes('event.clientY'), 'at the pointer');
  assert.ok(/const count = (1[6-9]|2[0-4]);/.test(drag), '16-24 pieces of confetti');
  assert.ok(drag.includes("'petit-poyo-bounce'"), 'the squash and stretch');
  const css = read('src/styles/koban-mascot.css');
  assert.ok(/@keyframes koban-confetti-fall/.test(css) && /@keyframes koban-confetti-sway/.test(css), 'gravity and sway');
  assert.ok(/@keyframes koban-particle-float/.test(css), 'the trail drifts up');
  assert.ok(/prefers-reduced-motion: reduce[\s\S]*koban-confetti/.test(css), 'reduced motion is respected');
});

await check('the companion says it can be dragged, and switches expression', () => {
  assert.ok(drag.includes('draggable-mascot-hint'), 'the hint pill');
  assert.ok(/\/koban-assets\/motion\/\$\{id\}_\$\{pose\}\.webp/.test(drag), 'the pose follows the mood');
  for (const pose of POSES) assert.ok(drag.includes(`'${pose}'`), pose);
});

await check('the old procedural body is bypassed for the six', () => {
  const clamp = read('src/components/mascot/ClampShoujoMascot.jsx');
  assert.ok(clamp.includes('<DraggableSparkleMascot'), 'the shoujo mascot hands the six to the real art');
  assert.ok(!clamp.includes('renderPetitPersona('), 'the blocky drawn body of the six is no longer drawn');
  assert.ok(clamp.includes('/koban-assets/face/'), 'the dock uses the real portraits');
});

/* --- the pages ------------------------------------------------------- */

await check('the login page: studio beside the simulators, parade of real art, and the shop banner', () => {
  const login = read('src/pages/Login.jsx');
  assert.ok(/login-gateway__mascot lg:col-span-5/.test(login), 'the studio is five columns');
  assert.ok(/login-gateway__cards lg:col-span-7/.test(login), 'the simulators are seven, beside it');
  assert.ok(login.includes('to="/koban-shop"') && login.includes('Mainkan Koban & Co. General Goods'), 'the shop banner');
  const parade = read('src/components/login/FriendSnapSections.jsx');
  assert.ok(parade.includes('<DraggableSparkleMascot'), 'the parade is the real art');
  assert.ok(!/<button[^>]*>\s*\{\/\*[^]*?<DraggableSparkleMascot/.test(parade), 'no button inside a button');
  assert.ok(read('src/i18n/id.js').includes('kobanShop: "Mainkan Koban & Co."'), 'the sidebar says play');
});

await check('the health coach: real companions, daily quests, what-if and one-tap fixes', () => {
  const bento = read('src/components/health/CuteWellnessBento.jsx');
  assert.ok(!bento.includes('<MiniFace mood'), 'the red drawn face is gone');
  for (const part of ['<KakeiboStudioMascots', '<DailyQuestCard', '<WhatIfSimulator', '<AuditFixPills']) {
    assert.ok(bento.includes(part), part);
  }
  assert.ok(/STATIONERY_CARD/.test(bento), 'stationery cards');
  const studio = read('src/components/health/KakeiboWellnessStudio.jsx');
  assert.ok(studio.includes("'/budgets?preset=50-30-20'") && studio.includes("'/goals?new=emergency'"), 'the fixes go somewhere');
  assert.ok(studio.includes('kobanActions.grantDailyQuest'), 'the quests pay into the shop');
  assert.ok(read('src/pages/Budgets.jsx').includes("selectedId={presetFromCoach ? 'balanced' : null}"), 'budgets opens the 50/30/20 recipe');
});

await check('the wellness maths: same rules as the server, a streak, and no double XP', async () => {
  const W = await import(path.join(FRONTEND, 'src/components/health/wellnessMath.js'));
  // savings 5% danger, 0.5 months danger, DSR excellent -> the server said 53.
  const debt = W.inferDebtPoints({ serverScore: 53, savings: 5, months: 0.5, dsr: 'excellent' });
  assert.deepEqual(W.simulateScore({ savings: 5, months: 0.5, dsr: 'excellent', debtPoints: debt }), { score: 53, grade: 'D' });
  const better = W.simulateScore({ savings: 30, months: 6, dsr: 'excellent', debtPoints: debt });
  assert.ok(better.score >= 88 && better.grade !== 'D', `a fixed score is ${better.score}`);
  assert.equal(W.moodForScore(50), 'sweating');
  assert.equal(W.moodForScore(75), 'celebrate');

  let s = W.emptyQuestState();
  s = W.toggleQuest(s, 'log_tx', '2026-11-15').state;
  const first = W.toggleQuest(s, 'no_spend', '2026-11-16');
  const off = W.toggleQuest(first.state, 'no_spend', '2026-11-16');
  const again = W.toggleQuest(off.state, 'no_spend', '2026-11-16');
  assert.equal(first.firstTimeToday, true);
  assert.equal(again.firstTimeToday, false, 'ticking again does not pay twice');
  assert.equal(again.state.xp, 50);
  assert.equal(W.liveStreak(again.state, '2026-11-16'), 2);
  assert.equal(W.liveStreak(again.state, '2026-11-19'), 0, 'a missed day breaks it');
});

await check('the shop engine pays a daily quest once a day', async () => {
  const E = await import(path.join(FRONTEND, 'src/features/koban-shop/store/kobanEngine.js'));
  const now = Date.UTC(2026, 10, 16, 3);
  const s0 = E.initialState(now);
  const a = E.grantDailyQuest(s0, 'no_spend', { koban: 100 }, now);
  const b = E.grantDailyQuest(a.state, 'no_spend', { koban: 100 }, now + 1000);
  assert.equal(a.state.koban, s0.koban + 100);
  assert.equal(b.granted, false);
  assert.equal(b.state.koban, a.state.koban);
  const gem = E.grantDailyQuest(b.state, 'save_20k', { gems: 1 }, now);
  assert.equal(gem.state.gems, s0.gems + 1);
});

const EMOJI = /[\u{1F300}-\u{1FAFF}]/u;

await check('/shopping: a stationery banner, drawn tab icons, and one-tap starter packs', () => {
  const page = read('src/pages/ShoppingTracker.jsx');
  assert.ok(!page.includes('bg-primary-600 text-white p-4 sticky'), 'the flat green bar is gone');
  assert.ok(page.includes('from-[#FFF6F4] via-[#FFFDF9] to-[#E6F3EC]'), 'the stationery banner');
  assert.ok(page.includes('persona="koneko"') && page.includes('persona="kogane"'), 'the two advisors');
  assert.ok(/TAB_ICONS = \{ tracked: 'clipboard', wishlist: 'coin', find: 'calculator', ai: 'chat_question' \}/.test(page));
  for (const id of ['kos', 'kopi', 'hadiah']) assert.ok(page.includes(`id: '${id}'`), id);
  const stray = page.split('\n').filter((l) => EMOJI.test(l) && !/🧪/.test(l));
  assert.deepEqual(stray, [], 'no emoji left');
});

await check('/kanban: pastel tape columns, drawn icons and a cheering Zenimaru', () => {
  const page = read('src/pages/Shopping/ShoppingPage.jsx');
  for (const tape of ['#FDE8E4', '#FFF6D6', '#E3F2EA', '#EFE8FA']) assert.ok(page.includes(tape), tape);
  assert.ok(page.includes('persona="zenimaru"') && page.includes('cheerMove()'), 'Zenimaru cheers a move');
  assert.ok(!EMOJI.test(page), 'no emoji left');
  assert.ok(!read('src/i18n/id.js').includes('🛒 Shopping Board'));
});

await check('/gmail: the post office, numbered steps, bank stickers and a guest simulation', async () => {
  const page = read('src/pages/GmailIntegration.jsx');
  assert.ok(!page.includes('from-red-500 to-red-600') && !page.includes('📧'), 'the red bar and the envelope are gone');
  assert.ok(page.includes('persona="kaneru"') && page.includes('name="receipt" size={42}'));
  for (const n of ['01', '02', '03', '04']) assert.ok(page.includes(`n: '${n}'`), n);
  for (const tint of ['#E3F2FD', '#FFF8E1', '#E0F2F1', '#E8EAF6', '#E0F7FA', '#F3E5F5', '#E1F5FE', '#FBE9E7']) {
    assert.ok(page.includes(tint), tint);
  }
  assert.ok(page.includes('bg-[#2F4842]') && page.includes('Hubungkan Gmail dengan Aman'), 'the capsule CTA');
  assert.ok(page.includes('Simulasi Test Import Email Contoh'), 'the simulation button');
  const P = await import(path.join(FRONTEND, 'src/utils/sampleEmailParser.js'));
  const parsed = P.SAMPLE_EMAILS.map(P.parseSampleEmail);
  assert.deepEqual(parsed.map((p) => p.amount), [38000, 45500, 6250000, 129900]);
  assert.deepEqual(parsed.map((p) => p.type), ['expense', 'expense', 'income', 'expense']);
});

console.log(`\nreal chibi mascot: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
