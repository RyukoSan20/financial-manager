/**
 * The drawing that goes in a goal's square.
 *
 * Every goal used to get the same picture: a target, drawn in the
 * colour the goal happened to have. A goal to pay for an operation
 * and a goal to save for a holiday were drawn the same way, so the
 * reader had to read the name to tell them apart.
 *
 * The goal already says what it is. The server keeps a `goal_type`
 * ("savings", "debt_payoff", "investment", "purchase",
 * "emergency_fund") and the reader may name an icon of their own. So
 * the square is drawn from that, and falls back to the target only
 * when the goal says nothing about itself.
 *
 * The word in the name counts too. A goal called "Operasi Lasik" is
 * a medical goal whatever the type says, and the reader is the one
 * who named it.
 */

import {
  Briefcase,
  CreditCard,
  GraduationCap,
  Heart,
  Home,
  LineChart,
  PiggyBank,
  Plane,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
  Target,
  Wallet,
} from 'lucide-react';

/**
 * The picture for each kind of goal the server knows about.
 */
const BY_TYPE = {
  savings: PiggyBank,
  savings_goal: PiggyBank,
  emergency_fund: ShieldCheck,
  investment: LineChart,
  debt_payoff: CreditCard,
  debt: CreditCard,
  purchase: ShoppingBag,
  education: GraduationCap,
  travel: Plane,
  health: Heart,
  medical: Stethoscope,
  car: Wallet,
  house: Home,
  business: Briefcase,
  retirement: PiggyBank,
};

/**
 * The words in a name that give the goal away.
 *
 * The key is a word, not a phrase, and it is matched against the
 * name in lower case. The order matters: the first match wins, so
 * the more specific words come first.
 */
const BY_WORD = [
  ['operation', Stethoscope],
  ['operation', Stethoscope],
  ['surgery', Stethoscope],
  ['hospital', Stethoscope],
  ['clinic', Stethoscope],
  ['medical', Stethoscope],
  ['medis', Stethoscope],
  ['health', Heart],
  ['kesehatan', Heart],
  ['dokter', Stethoscope],
  ['sakit', Heart],
  ['rawat', Stethoscope],
  ['sekolah', GraduationCap],
  ['school', GraduationCap],
  ['kuliah', GraduationCap],
  ['university', GraduationCap],
  ['education', GraduationCap],
  ['education', GraduationCap],
  ['travel', Plane],
  ['liburan', Plane],
  ['vacation', Plane],
  ['haji', Plane],
  ['umroh', Plane],
  ['invest', LineChart],
  ['saham', LineChart],
  ['reksa', LineChart],
  ['deposito', LineChart],
  ['emergency', ShieldCheck],
  ['darurat', ShieldCheck],
  ['house', Home],
  ['rumah', Home],
  ['flat', Home],
  ['apartemen', Home],
  ['car', Wallet],
  ['mobil', Wallet],
  ['motor', Wallet],
  ['motorcycle', Wallet],
  ['business', Briefcase],
  ['usaha', Briefcase],
  ['bisnis', Briefcase],
  ['retire', PiggyBank],
  ['pensiun', PiggyBank],
  ['saving', PiggyBank],
  ['tabungan', PiggyBank],
  ['debt', CreditCard],
  ['utang', CreditCard],
  ['cicilan', CreditCard],
  ['loan', CreditCard],
];

/**
 * The picture for a goal.
 *
 * @param {object} goal   the goal as the server sent it
 * @returns {Function} the lucide drawing to use
 */
export function goalIcon(goal) {
  if (!goal) return Target;

  // The reader's own choice of icon, when they named one we know.
  const named = String(goal.icon || '').trim().toLowerCase();
  if (named && BY_TYPE[named]) return BY_TYPE[named];

  const type = String(goal.goal_type || goal.type || '').trim().toLowerCase();
  if (type && BY_TYPE[type]) return BY_TYPE[type];

  // The name of the goal. The reader named it, so it is the best
  // thing to go on.
  const name = String(goal.name || '').toLowerCase();
  if (name) {
    for (const [word, Icon] of BY_WORD) {
      if (name.includes(word)) return Icon;
    }
  }

  // Nothing said: the target, as before.
  return Target;
}

export default goalIcon;
