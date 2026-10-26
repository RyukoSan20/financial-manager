/**
 * One icon family.
 *
 * Some screens used an emoji where an icon belongs: a shopping cart
 * drawn by the phone's font, a bank drawn by the phone's font. They
 * look different on every machine, they do not follow the colour
 * scheme, and they are not the same size as the icons beside them.
 *
 * This is the map from the old emoji to the icon family the rest of
 * the application already uses. The emoji are still there when the
 * polish switch is off; the icons are used when it is on.
 *
 * The names are the ones used in the screens, so the map reads the
 * same way as the code it replaces.
 */

import {
  Banknote,
  BarChart3,
  LineChart,
  CheckCircle,
  XCircle,
  Lightbulb,
  Package,
  PiggyBank,
  ShieldCheck,
  ShoppingCart,
  Target,
  TrendingDown,
  Truck,
  Wallet,
} from 'lucide-react';

/**
 * The shopping board stages.
 *
 * The key is the stage id, which is what the board uses to decide
 * which column an item belongs in.
 */
export const SHOPPING_STAGE_ICONS = {
  wishlist: Lightbulb,
  to_buy: ShoppingCart,
  ordered: Package,
  shipped: Truck,
  received: CheckCircle,
  cancelled: XCircle,
};

/**
 * The AI Advisor quick prompts.
 *
 * The key is the prompt, which is what the chip asks about.
 */
export const ADVISOR_PROMPT_ICONS = {
  prompt_budget: Wallet,
  prompt_goal: Target,
  prompt_saving: PiggyBank,
  prompt_expense: TrendingDown,
  prompt_invest: LineChart,
  prompt_emergency: ShieldCheck,
};

/**
 * The banks named on the Gmail Sync screen.
 */
export const BANK_ICONS = {
  bca: Banknote,
  mandiri: Banknote,
  bni: Banknote,
  bri: Banknote,
  bca_syariah: Banknote,
  bni_syariah: Banknote,
  permata: Banknote,
  cimb: Banknote,
  danamon: Banknote,
  ocbc: Banknote,
  uob: Banknote,
  maybank: Banknote,
  standard_chartered: Banknote,
  hsbc: Banknote,
  cba: Banknote,
  anz: Banknote,
  bsb: Banknote,
  btpn: Banknote,
  bank_syariah: Banknote,
  bank_umi: Banknote,
  bank_dki: Banknote,
  bank_jateng: Banknote,
  bank_bni: Banknote,
  bank_bca: Banknote,
};

/**
 * The streak flame on the profile card.
 */
export const STREAK_ICON = BarChart3;

export default {
  SHOPPING_STAGE_ICONS,
  ADVISOR_PROMPT_ICONS,
  BANK_ICONS,
  STREAK_ICON,
};
