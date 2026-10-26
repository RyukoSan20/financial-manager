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
 *
 * Every name below was checked against the icon set the application
 * actually has installed, so nothing here fails to load.
 */

import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  CheckCircle,
  ChevronRight,
  Circle,
  CircleDollarSign,
  Clapperboard,
  Clock,
  Coffee,
  CreditCard,
  Download,
  FileText,
  Filter,
  Flame,
  FolderOpen,
  GraduationCap,
  HandCoins,
  Heart,
  Inbox,
  Info,
  Landmark,
  Lightbulb,
  LineChart,
  ListTodo,
  Mail,
  MapPin,
  Mic,
  NotebookPen,
  Package,
  PackageCheck,
  PackageOpen,
  PackageX,
  PenLine,
  PieChart,
  PiggyBank,
  Plane,
  Plus,
  Receipt,
  RefreshCw,
  Repeat2,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Truck,
  Upload,
  Utensils,
  Wallet,
  X,
  XCircle,
  Zap,
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
 *
 * Every one of these was a bank emoji. They all become the same
 * banknote icon, which is the point: one drawing, not twenty.
 */
export const BANK_ICONS = {
  bca: Landmark,
  mandiri: Landmark,
  bni: Landmark,
  bri: Landmark,
  bca_syariah: Landmark,
  bni_syariah: Landmark,
  permata: Landmark,
  cimb: Landmark,
  danamon: Landmark,
  ocbc: Landmark,
  uob: Landmark,
  maybank: Landmark,
  standard_chartered: Landmark,
  hsbc: Landmark,
  cba: Landmark,
  anz: Landmark,
  bsb: Landmark,
  btpn: Landmark,
  bank_syariah: Landmark,
  bank_umi: Landmark,
  bank_dki: Landmark,
  bank_jateng: Landmark,
  bank_bni: Landmark,
  bank_bca: Landmark,
};

/**
 * The wallet providers named on the Gmail Sync screen.
 *
 * GoPay, OVO, DANA and ShopeePay were each a coloured heart. They
 * become the same wallet icon.
 */
export const WALLET_ICONS = {
  gopay: Wallet,
  ovo: Wallet,
  dana: Wallet,
  shopeepay: Wallet,
};

/**
 * The streak flame on the profile card.
 */
export const STREAK_ICON = Flame;

/**
 * The category drawings.
 *
 * The key is the category id, which is what the category rows use.
 */
export const CATEGORY_ICONS = {
  salary: CircleDollarSign,
  freelance: Briefcase,
  investment_income: TrendingUp,
  bonus: Sparkles,
  other_income: PackageOpen,
  food_drink: Coffee,
  transportation: Plane,
  shopping: ShoppingBag,
  health: Heart,
  education: GraduationCap,
  entertainment: Clapperboard,
  bills_utilities: Zap,
  savings_investment: PiggyBank,
  other_expense: FolderOpen,
};

/**
 * The other drawings used across the screens.
 *
 * The key is what the drawing stands for, so a screen asks for
 * "warning" rather than remembering which emoji it used before.
 */
export const ICONS = {
  // A heading that introduces a set of numbers.
  chart: BarChart3,
  chart_line: LineChart,
  chart_pie: PieChart,

  // A heading that introduces spending.
  expense: TrendingDown,
  income: TrendingUp,

  // The money ones.
  money: Wallet,
  savings: PiggyBank,
  payment: CreditCard,
  receipt: Receipt,
  coins: CircleDollarSign,
  hand_coins: HandCoins,

  // The places.
  store: Store,
  merchant: Store,
  location: MapPin,
  building: Building2,
  food: Utensils,
  groceries: ShoppingBag,

  // The things that happen.
  income_added: CircleDollarSign,
  expense_added: TrendingDown,
  deleted: Trash2,
  edited: PenLine,
  archived: Package,

  // The states.
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  inbox: Inbox,
  empty_circle: Circle,
  danger: AlertCircle,
  note: Lightbulb,
  celebration: Sparkles,
  trophy: Trophy,
  goal: Target,

  // The small marks.
  check: Check,
  cross: X,
  arrow_up: ArrowUp,
  arrow_down: ArrowDown,
  arrow_right: ChevronRight,
  arrow_up_right: ArrowUpRight,
  arrow_left: ArrowLeft,
  sort: ArrowUpDown,
  refresh: RefreshCw,
  add: Plus,
  search: Search,
  filter: Filter,
  trash: Trash2,

  // The tools.
  file: FileText,
  upload: Upload,
  download: Download,
  list: ListTodo,
  repeat: Repeat2,
  bell: Bell,
  clock: Clock,
  calendar: CalendarDays,
  folder: FolderOpen,
  notebook: NotebookPen,
  book: BookOpen,
  phone: Smartphone,
  mic: Mic,
  star: Star,
  heart: Heart,
  zap: Zap,

  // The shopping board.
  cart: ShoppingCart,
  package: Package,
  package_open: PackageOpen,
  package_check: PackageCheck,
  package_x: PackageX,
  truck: Truck,
  shipping: Truck,

  // The streak.
  streak: Flame,
};

export {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  CheckCircle,
  ChevronRight,
  Circle,
  CircleDollarSign,
  Clapperboard,
  Clock,
  Coffee,
  CreditCard,
  Download,
  FileText,
  Filter,
  Flame,
  FolderOpen,
  GraduationCap,
  HandCoins,
  Heart,
  Inbox,
  Info,
  Landmark,
  Lightbulb,
  LineChart,
  ListTodo,
  Mail,
  MapPin,
  Mic,
  NotebookPen,
  Package,
  PackageCheck,
  PackageOpen,
  PackageX,
  PenLine,
  PieChart,
  PiggyBank,
  Plane,
  Plus,
  Receipt,
  RefreshCw,
  Repeat2,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Truck,
  Upload,
  Utensils,
  Wallet,
  X,
  XCircle,
  Zap,
};

export default {
  SHOPPING_STAGE_ICONS,
  ADVISOR_PROMPT_ICONS,
  BANK_ICONS,
  WALLET_ICONS,
  STREAK_ICON,
  CATEGORY_ICONS,
  ICONS,
};
