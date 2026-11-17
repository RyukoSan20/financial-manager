/**
 * The small parts every RPG screen shares: the parchment frame, the
 * patterned banners, the gold plaque button, the round wooden close
 * button, the drawn stat icons, the typewriter, and the words.
 */

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from '../../../i18n';

/* --- the words --------------------------------------------------------- */

const COPY = {
  id: {
    back: 'FinManager',
    tabs: { shop: 'Shop', quest: 'Quest', synth: 'Synthesizing', menu: 'Menu' },
    gold: 'Emas', pop: 'Popularitas', stamina: 'Stamina',
    badgeShop: 'Badge Shop', orderBox: 'Order Box', newTag: 'NEW',
    fever: 'FEVER', bonusChance: 'Shop Bonus Chance!', feverTime: 'FEVER TIME!',
    tapToDisplay: ['TapTo', 'Display'], tapToConfirm: 'TapToConfirm',
    selectTitle: 'Pilih barang untuk dipajang.',
    no: 'No.', get: 'Asal', price: 'Harga', popularity: 'Popularitas', bonus: 'Bonus',
    sortOrder: 'Urutan', sortPrice: 'Harga', sortQty: 'Jumlah', sortPop: 'Popularitas',
    recommended: 'Rekomendasi', emptyStore: 'Gudang kosong. Racik barang dulu di Synthesizing.',
    takeBack: 'Tarik dari meja', close: 'Tutup',
    pop1: 'Rendah', pop2: 'Sedang', pop3: 'Tinggi',
    badgeTitle: 'Lencana guild menambah kekuatan toko.', owned: 'Terpasang', buy: 'Beli',
    orderTitle: 'Surat pesanan warga', orderLead: 'Sempurna 150% · Cocok 100% · Salah 0% (barang kembali).',
    townTitle: 'Kota Aurelia', pickFacility: 'Pilih bengkel untuk meracik.',
    facility: { restaurant: 'Restaurant', wizardry: 'Wizardry Shop', blacksmith: 'Blacksmith', seamstress: 'Seamstress' },
    synthRecipe: 'Synthesize as Recipe', buyRecipe: 'Purchase Recipe',
    recipeBought: (name) => `Resep baru: ${name}!`, recipeNone: 'Semua resep bengkel ini sudah dimiliki.', notEnough: 'Koban belum cukup.',
    locked: (ch) => `Terbuka di Bab ${ch}`,
    greet: {
      restaurant: 'Halo! Bahan segar dari ekspedisi sudah siap diracik menjadi produk unggulan!',
      wizardry: 'Selamat datang di menara. Ramuan hari ini wanginya seperti hujan pertama.',
      blacksmith: 'Tungku sudah panas! Bawa bijihnya, kutempa jadi barang yang laku keras.',
      seamstress: 'Kain terbaik untuk pelanggan terbaik. Mau menjahit apa hari ini?',
    },
    worldTitle: 'Peta Dunia', itemsToObtain: 'Items to Obtain', recLevel: 'Level prajurit disarankan',
    soldierUpgrade: 'Soldier Upgrade', soldierLead: 'Kamu bisa membuat para prajurit lebih kuat!',
    levelUp: 'Level Up', tapConfirm: 'Tap to Confirm', noStamina: 'Stamina habis. Tunggu sebentar atau catat transaksi hari ini.',
    highSpeed: 'High-Speed', guard: 'Guard!', victory: 'MENANG!', defeat: 'MUNDUR...', loot: 'Bawaan pulang', backToMap: 'Kembali ke peta',
    partyLv: 'Lv. pasukan',
    menuTitle: 'Menu', mOrder: 'Order Box', mLedger: 'Buku Kakeibo Kaneru', mVault: 'Brankas Majemuk Mone', mDebt: 'Utang Kerajaan',
    mBook: (n) => `Ensiklopedia ${n} Barang`, mCast: 'Para Penjaga Toko', mStore: 'Gudang & Catatan', mReset: 'Mulai ulang toko',
    found: 'ditemukan', storeTitle: 'barang siap jual', logTitle: 'Catatan toko', logEmpty: 'Belum ada catatan.',
    offlineTitle: 'Laporan Saat Toko Ditinggal', thanks: 'Terima kasih!',
    drag: 'Geser aku!', chapter: 'Bab',
  },
  en: {
    back: 'FinManager',
    tabs: { shop: 'Shop', quest: 'Quest', synth: 'Synthesizing', menu: 'Menu' },
    gold: 'Gold', pop: 'Popularity', stamina: 'Stamina',
    badgeShop: 'Badge Shop', orderBox: 'Order Box', newTag: 'NEW',
    fever: 'FEVER', bonusChance: 'Shop Bonus Chance!', feverTime: 'FEVER TIME!',
    tapToDisplay: ['TapTo', 'Display'], tapToConfirm: 'TapToConfirm',
    selectTitle: 'Please select the items to display.',
    no: 'No.', get: 'Get', price: 'Price', popularity: 'Popularity', bonus: 'Bonus',
    sortOrder: 'Sort Order', sortPrice: 'By Price', sortQty: 'By Qty', sortPop: 'By Popularity',
    recommended: 'Recommended', emptyStore: 'The storeroom is empty. Craft something in Synthesizing first.',
    takeBack: 'Take off the table', close: 'Close',
    pop1: 'Low', pop2: 'Mid', pop3: 'High',
    badgeTitle: 'Guild badges make the shop stronger.', owned: 'Owned', buy: 'Buy',
    orderTitle: 'Letters from the townsfolk', orderLead: 'Perfect 150% · Match 100% · Wrong 0% (item returned).',
    townTitle: 'Aurelia Town', pickFacility: 'Pick a workshop to craft in.',
    facility: { restaurant: 'Restaurant', wizardry: 'Wizardry Shop', blacksmith: 'Blacksmith', seamstress: 'Seamstress' },
    synthRecipe: 'Synthesize as Recipe', buyRecipe: 'Purchase Recipe',
    recipeBought: (name) => `New recipe: ${name}!`, recipeNone: 'You own every recipe of this workshop.', notEnough: 'Not enough Koban.',
    locked: (ch) => `Opens in Chapter ${ch}`,
    greet: {
      restaurant: 'Hello! Fresh ingredients from the expedition are ready to become our best sellers!',
      wizardry: 'Welcome to the tower. Today the potions smell like the first rain.',
      blacksmith: 'The forge is hot! Bring the ore and I will hammer it into something that sells.',
      seamstress: 'The finest cloth for the finest customers. What shall we sew today?',
    },
    worldTitle: 'World Map', itemsToObtain: 'Items to Obtain', recLevel: 'Recommended Soldier Level',
    soldierUpgrade: 'Soldier Upgrade', soldierLead: 'You can make the soldiers stronger!',
    levelUp: 'Level Up', tapConfirm: 'Tap to Confirm', noStamina: 'Out of stamina. Wait a little, or log a transaction today.',
    highSpeed: 'High-Speed', guard: 'Guard!', victory: 'VICTORY!', defeat: 'RETREAT...', loot: 'Brought home', backToMap: 'Back to the map',
    partyLv: 'Party Lv.',
    menuTitle: 'Menu', mOrder: 'Order Box', mLedger: "Kaneru's Kakeibo Ledger", mVault: "Mone's Compound Vault", mDebt: 'Royal Debt Payoff',
    mBook: (n) => `${n}-Item Encyclopedia`, mCast: 'The Shopkeepers', mStore: 'Storeroom & Log', mReset: 'Restart the shop',
    found: 'found', storeTitle: 'items ready to sell', logTitle: 'Shop log', logEmpty: 'Nothing yet.',
    offlineTitle: 'While You Were Away', thanks: 'Thank you!',
    drag: 'Drag me!', chapter: 'Chapter',
  },
};

export function useKobanCopy() {
  const { language } = useTranslation();
  return COPY[language === 'en' ? 'en' : 'id'];
}

/* --- the typewriter ---------------------------------------------------- */

/** Reveal `text` a character at a time. `talking` is true until it is all out. */
export function useTypewriter(text, cps = 34) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return undefined;
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) { window.clearInterval(id); return v; }
        return v + 1;
      });
    }, 1000 / cps);
    return () => window.clearInterval(id);
  }, [text, cps]);
  return { shown: (text || '').slice(0, n), talking: n < (text || '').length };
}

/* --- drawn icons ------------------------------------------------------- */

const S = { stroke: '#4A2E12', strokeWidth: 1.6, strokeLinejoin: 'round', strokeLinecap: 'round' };

export function Icon({ name, size = 18, className = '' }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', className: clsx('inline-block flex-none', className), 'aria-hidden': true, focusable: 'false' };
  switch (name) {
    case 'coin':
      return <svg {...p}><ellipse cx="12" cy="12" rx="8" ry="9.5" fill="#F4C542" {...S} /><ellipse cx="12" cy="12" rx="5" ry="6.4" fill="none" stroke="#B8821A" strokeWidth="1.3" /><rect x="10.3" y="9.3" width="3.4" height="5.4" rx=".6" fill="#B8821A" /></svg>;
    case 'smile':
      return <svg {...p}><circle cx="12" cy="12" r="9.5" fill="#FFD866" {...S} /><circle cx="8.6" cy="10" r="1.3" fill="#4A2E12" /><circle cx="15.4" cy="10" r="1.3" fill="#4A2E12" /><path d="M7.5 13.6 Q12 18.6 16.5 13.6" fill="none" {...S} /></svg>;
    case 'sweat':
      return <svg {...p}><circle cx="11" cy="12.5" r="9" fill="#FFE9A8" {...S} /><path d="M7 11 l3 1 M15 11 l-3 1" {...S} fill="none" /><path d="M8 17 q3 -2 6 0" fill="none" {...S} /><path d="M19.5 3 q3 4.4 1.6 6.2 a2.2 2.2 0 0 1 -3.2 0 q-1.4 -1.8 1.6 -6.2z" fill="#8FCBF2" stroke="#4E9AE0" strokeWidth="1.1" /></svg>;
    case 'bolt':
      return <svg {...p}><path d="M13.5 1.5 L4.5 13.5 h6 l-1.5 9 9.5 -12.5 h-6.2z" fill="#FFD23F" {...S} /></svg>;
    case 'shield':
      return <svg {...p}><path d="M12 2 l8.5 3 v6.2 c0 5.2 -3.6 8.8 -8.5 10.8 c-4.9 -2 -8.5 -5.6 -8.5 -10.8 V5z" fill="#6FA8E8" {...S} /><path d="M12 5 v14 M6.5 10.5 h11" stroke="#FFFFFF" strokeWidth="1.8" /></svg>;
    case 'mail':
      return <svg {...p}><rect x="2.5" y="5" width="19" height="14" rx="2" fill="#FFFDF7" {...S} /><path d="M3 6.5 l9 7 9 -7" fill="none" {...S} /><circle cx="12" cy="14.5" r="2.2" fill="#D9462F" stroke="#4A2E12" strokeWidth="1" /></svg>;
    case 'heart':
      return <svg {...p}><path d="M12 20.5 C3 14 2.5 9 5.5 6 c2.6 -2.4 5.6 -1 6.5 1.4 c.9 -2.4 3.9 -3.8 6.5 -1.4 c3 3 2.5 8 -6.5 14.5z" fill="#F0607A" {...S} /><path d="M7.2 8.2 q1.4 -1.6 3 -.4" fill="none" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" /></svg>;
    case 'heart-empty':
      return <svg {...p}><path d="M12 20.5 C3 14 2.5 9 5.5 6 c2.6 -2.4 5.6 -1 6.5 1.4 c.9 -2.4 3.9 -3.8 6.5 -1.4 c3 3 2.5 8 -6.5 14.5z" fill="#E8D9C2" {...S} /></svg>;
    case 'sword':
      return <svg {...p}><path d="M19.5 2.5 l2 2 -10.5 11 -2.6 -2.6z" fill="#E6EDF3" {...S} /><path d="M6.5 11.5 l6 6" {...S} strokeWidth="2.6" stroke="#B8821A" /><path d="M8 16 l-4.5 4.5" {...S} strokeWidth="2.6" stroke="#8A5A3C" /></svg>;
    case 'star':
      return <svg {...p}><path d="M12 1.8 l3.1 6.5 7 .9 -5.2 4.8 1.4 7 -6.3 -3.5 -6.3 3.5 1.4 -7 -5.2 -4.8 7 -.9z" fill="#FFD23F" {...S} /></svg>;
    case 'book':
      return <svg {...p}><path d="M3 4.5 q4.5 -1.6 9 .8 q4.5 -2.4 9 -.8 v14.5 q-4.5 -1.6 -9 .8 q-4.5 -2.4 -9 -.8z" fill="#FFFDF7" {...S} /><path d="M12 5.3 v14.5" {...S} /><path d="M5.5 8.5 h4 M5.5 11.5 h4 M14.5 8.5 h4 M14.5 11.5 h4" stroke="#B8821A" strokeWidth="1.2" /></svg>;
    case 'scroll':
      return <svg {...p}><path d="M6 3.5 h12 a2.5 2.5 0 0 1 0 5 h-1 v10 a2.5 2.5 0 0 1 -2.5 2.5 h-9 a2.5 2.5 0 0 1 0 -5 h1 v-10 a2.5 2.5 0 0 0 -2.5 -2.5z" fill="#F6E7C4" {...S} /><path d="M9.5 9 h5 M9.5 12 h5 M9.5 15 h3" stroke="#8A5A3C" strokeWidth="1.2" /></svg>;
    case 'vault':
      return <svg {...p}><rect x="3" y="4" width="18" height="15" rx="2.4" fill="#C9D2DC" {...S} /><circle cx="12" cy="11.5" r="4" fill="#F4C542" {...S} /><path d="M12 7.5 v8 M8 11.5 h8" stroke="#4A2E12" strokeWidth="1.2" /><path d="M6 19 v2 M18 19 v2" {...S} /></svg>;
    case 'crown':
      return <svg {...p}><path d="M3 18 L2.5 7 l5 4.5 L12 4 l4.5 7.5 5 -4.5 L21 18z" fill="#F4C542" {...S} /><path d="M3.5 20.5 h17" {...S} strokeWidth="2.4" /></svg>;
    case 'people':
      return <svg {...p}><circle cx="8" cy="8" r="3.6" fill="#F7B8C0" {...S} /><circle cx="16.5" cy="9" r="3" fill="#A8E6CF" {...S} /><path d="M2 20.5 q0 -6.5 6 -6.5 q6 0 6 6.5z" fill="#F7B8C0" {...S} /><path d="M14 20.5 q.4 -5 3.5 -5 q4 0 4.5 5z" fill="#A8E6CF" {...S} /></svg>;
    case 'crate':
      return <svg {...p}><rect x="3" y="5" width="18" height="15" rx="1.6" fill="#D9A866" {...S} /><path d="M3 10 h18 M9 5 v15 M15 5 v15" {...S} /></svg>;
    case 'map':
      return <svg {...p}><path d="M3 5.5 l6 -2 6 2 6 -2 v15 l-6 2 -6 -2 -6 2z" fill="#CFE8B4" {...S} /><path d="M9 3.5 v15 M15 5.5 v15" {...S} /><path d="M11 10 l2 2 m0 -2 l-2 2" stroke="#D9462F" strokeWidth="1.6" strokeLinecap="round" /></svg>;
    case 'shop':
      return <svg {...p}><path d="M3 10 l2 -6 h14 l2 6z" fill="#F0705C" {...S} /><path d="M4.5 10 v10 h15 V10" fill="#FBF1D6" {...S} /><rect x="10" y="13.5" width="4" height="6.5" fill="#8A5A3C" {...S} /><path d="M8 4 l-1 6 M12 4 v6 M16 4 l1 6" stroke="#FFFDF7" strokeWidth="1.4" /></svg>;
    case 'flask':
      return <svg {...p}><path d="M9.5 2.5 h5 M10 2.5 v6 L4.5 19 a1.8 1.8 0 0 0 1.6 2.6 h11.8 a1.8 1.8 0 0 0 1.6 -2.6 L14 8.5 v-6" fill="#E9F6FF" {...S} /><path d="M7.4 14.5 h9.2 l2.6 5 a1 1 0 0 1 -.9 1.4 H5.7 a1 1 0 0 1 -.9 -1.4z" fill="#B88CE8" /></svg>;
    case 'menu':
      return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3.4" fill="#FBF1D6" {...S} /><path d="M7.5 8.5 h9 M7.5 12 h9 M7.5 15.5 h9" {...S} strokeWidth="2" /></svg>;
    case 'arrow':
      return <svg {...p}><path d="M4 12 h13 M12 6 l6 6 -6 6" fill="none" {...S} strokeWidth="2.4" /></svg>;
    case 'check':
      return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" fill="#FFFDF7" {...S} /><path d="M6.5 12.5 l4 4 7.5 -9" fill="none" stroke="#3FA65A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'box':
      return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" fill="#FFFDF7" {...S} /></svg>;
    default:
      return null;
  }
}

/* --- frames ------------------------------------------------------------ */

export function Parchment({ className = '', children, ...rest }) {
  return <div className={clsx('krpg-parchment', className)} {...rest}>{children}</div>;
}

/** A banner above or below a scene. `tone`: gold (town) or sky (quest). */
export function PatternBanner({ tone = 'gold', className = '', children, ...rest }) {
  return <div className={clsx('krpg-banner', `krpg-banner--${tone}`, className)} {...rest}>{children}</div>;
}

export function GoldButton({ className = '', tone = 'gold', children, ...rest }) {
  return (
    <button type="button" className={clsx('krpg-gold-btn', tone !== 'gold' && `krpg-gold-btn--${tone}`, className)} {...rest}>
      {children}
    </button>
  );
}

export function WoodClose({ onClick, label = 'Tutup', className = '' }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={clsx('krpg-wood-close', className)}>
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M4 4 l12 12 M16 4 l-12 12" stroke="#FFF3D6" strokeWidth="3.2" strokeLinecap="round" /></svg>
    </button>
  );
}

/** A modal that sits over the whole game, safe on a phone. */
export function RpgModal({ open, onClose, children, className = '', testId }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="krpg-modal" role="dialog" aria-modal="true" onClick={onClose} data-testid={testId}>
      <div className={clsx('krpg-modal__body', className)} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Stars({ n = 1, size = 12 }) {
  return <span className="inline-flex" aria-label={`${n} stars`}>{Array.from({ length: n }, (_, i) => <Icon key={i} name="star" size={size} />)}</span>;
}
