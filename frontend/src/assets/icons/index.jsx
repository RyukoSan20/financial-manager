/**
 * Pixel Art Icon Library
 * Based on dot-illust.net style (8-bit pixel aesthetic)
 * Each icon uses a 16x16 or 32x32 pixel grid
 */

export const Icon = ({ 
  children, 
  size = 24, 
  className = '', 
  color = 'currentColor',
  style = {} 
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill={color}
    className={`pixel-icon ${className}`}
    style={{
      imageRendering: 'pixelated',
      ...style
    }}
  >
    {children}
  </svg>
);

// ============ NAVIGATION ICONS ============

export const HomeIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* House shape */}
    <rect x="7" y="8" width="2" height="5" />
    <rect x="4" y="10" width="8" height="4" />
    <rect x="7" y="4" width="2" height="4" />
    <rect x="5" y="7" width="6" height="1" />
    {/* Roof */}
    <rect x="3" y="7" width="1" height="1" />
    <rect x="12" y="7" width="1" height="1" />
    <rect x="4" y="6" width="1" height="1" />
    <rect x="11" y="6" width="1" height="1" />
    <rect x="5" y="5" width="1" height="1" />
    <rect x="10" y="5" width="1" height="1" />
    <rect x="6" y="4" width="1" height="1" />
    <rect x="9" y="4" width="1" height="1" />
    <rect x="7" y="3" width="2" height="1" />
    <rect x="8" y="2" width="1" height="1" />
  </Icon>
);

export const ListIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* List/hamburger menu */}
    <rect x="3" y="3" width="10" height="1" />
    <rect x="3" y="7" width="10" height="1" />
    <rect x="3" y="11" width="10" height="1" />
    {/* Dots */}
    <rect x="11" y="3" width="2" height="1" />
    <rect x="11" y="7" width="2" height="1" />
    <rect x="11" y="11" width="2" height="1" />
  </Icon>
);

export const TargetIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Bullseye/target */}
    <rect x="7" y="2" width="2" height="1" />
    <rect x="6" y="3" width="4" height="1" />
    <rect x="3" y="4" width="10" height="1" />
    <rect x="3" y="5" width="2" height="1" />
    <rect x="11" y="5" width="2" height="1" />
    <rect x="2" y="6" width="12" height="1" />
    <rect x="2" y="7" width="2" height="2" />
    <rect x="12" y="7" width="2" height="2" />
    <rect x="4" y="7" width="2" height="1" />
    <rect x="10" y="7" width="2" height="1" />
    <rect x="6" y="7" width="4" height="1" />
    <rect x="7" y="8" width="2" height="1" />
    <rect x="2" y="9" width="12" height="1" />
    <rect x="3" y="10" width="2" height="1" />
    <rect x="11" y="10" width="2" height="1" />
    <rect x="3" y="11" width="10" height="1" />
    <rect x="6" y="12" width="4" height="1" />
    <rect x="7" y="13" width="2" height="1" />
    {/* Center dot */}
    <rect x="7" y="7" width="2" height="2" fill="white" />
  </Icon>
);

export const MenuIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="2" y="4" width="12" height="2" />
    <rect x="2" y="7" width="12" height="2" />
    <rect x="2" y="10" width="12" height="2" />
  </Icon>
);

// ============ ACTION ICONS ============

export const PlusIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="7" y="2" width="2" height="12" />
    <rect x="2" y="7" width="12" height="2" />
  </Icon>
);

export const EditIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Pencil shape */}
    <rect x="3" y="3" width="2" height="1" />
    <rect x="5" y="4" width="2" height="1" />
    <rect x="7" y="5" width="2" height="1" />
    <rect x="9" y="6" width="2" height="1" />
    <rect x="10" y="7" width="2" height="1" />
    <rect x="10" y="8" width="2" height="1" />
    <rect x="10" y="9" width="2" height="1" />
    <rect x="9" y="10" width="2" height="1" />
    <rect x="8" y="11" width="2" height="1" />
    <rect x="7" y="12" width="2" height="1" />
    <rect x="3" y="12" width="4" height="1" />
    <rect x="2" y="11" width="2" height="1" />
  </Icon>
);

export const DeleteIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Trash can */}
    <rect x="4" y="3" width="8" height="1" />
    <rect x="3" y="4" width="2" height="1" />
    <rect x="11" y="4" width="2" height="1" />
    <rect x="3" y="5" width="10" height="1" />
    <rect x="3" y="6" width="1" height="5" />
    <rect x="4" y="6" width="8" height="1" />
    <rect x="12" y="6" width="1" height="5" />
    <rect x="5" y="7" width="2" height="1" />
    <rect x="9" y="7" width="2" height="1" />
    <rect x="5" y="9" width="2" height="1" />
    <rect x="9" y="9" width="2" height="1" />
    <rect x="4" y="11" width="8" height="1" />
    <rect x="5" y="12" width="6" height="2" />
    <rect x="6" y="14" width="4" height="1" />
  </Icon>
);

export const SearchIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Magnifying glass */}
    <rect x="3" y="3" width="6" height="1" />
    <rect x="2" y="4" width="7" height="1" />
    <rect x="2" y="5" width="1" height="2" />
    <rect x="8" y="5" width="1" height="2" />
    <rect x="3" y="7" width="6" height="1" />
    <rect x="4" y="8" width="5" height="1" />
    <rect x="5" y="9" width="4" height="1" />
    <rect x="6" y="10" width="3" height="1" />
    <rect x="7" y="11" width="2" height="1" />
    <rect x="8" y="12" width="1" height="1" />
    <rect x="8" y="13" width="1" height="1" />
    <rect x="9" y="14" width="2" height="1" />
    <rect x="11" y="13" width="1" height="1" />
    <rect x="10" y="12" width="1" height="1" />
  </Icon>
);

export const FilterIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Funnel */}
    <rect x="3" y="2" width="10" height="2" />
    <rect x="4" y="4" width="8" height="2" />
    <rect x="5" y="6" width="6" height="2" />
    <rect x="6" y="8" width="4" height="2" />
    <rect x="7" y="10" width="2" height="3" />
  </Icon>
);

export const CameraIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="2" y="5" width="12" height="7" />
    <rect x="3" y="6" width="10" height="5" />
    <rect x="5" y="7" width="6" height="3" fill="white" />
    <rect x="11" y="3" width="2" height="2" />
    <rect x="3" y="3" width="2" height="1" />
    <rect x="10" y="9" width="2" height="1" fill="white" />
  </Icon>
);

export const QRCodeIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* QR code pattern */}
    <rect x="2" y="2" width="4" height="4" />
    <rect x="3" y="3" width="2" height="2" fill="white" />
    <rect x="10" y="2" width="4" height="4" />
    <rect x="11" y="3" width="2" height="2" fill="white" />
    <rect x="2" y="10" width="4" height="4" />
    <rect x="3" y="11" width="2" height="2" fill="white" />
    <rect x="7" y="2" width="2" height="2" />
    <rect x="10" y="7" width="2" height="1" />
    <rect x="12" y="7" width="1" height="1" />
    <rect x="7" y="7" width="2" height="1" />
    <rect x="9" y="9" width="1" height="1" />
    <rect x="11" y="9" width="2" height="1" />
    <rect x="7" y="10" width="1" height="1" />
    <rect x="9" y="10" width="1" height="1" />
    <rect x="11" y="11" width="1" height="1" />
    <rect x="13" y="11" width="1" height="1" />
    <rect x="8" y="12" width="1" height="1" />
    <rect x="10" y="12" width="1" height="1" />
    <rect x="13" y="12" width="1" height="1" />
    <rect x="7" y="13" width="1" height="1" />
    <rect x="12" y="13" width="1" height="1" />
  </Icon>
);

export const ScanIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Scan lines */}
    <rect x="2" y="4" width="12" height="1" />
    <rect x="2" y="7" width="12" height="1" />
    <rect x="2" y="10" width="12" height="1" />
    <rect x="6" y="3" width="4" height="1" />
    <rect x="6" y="12" width="4" height="1" />
    <rect x="5" y="4" width="1" height="1" />
    <rect x="10" y="4" width="1" height="1" />
    <rect x="5" y="11" width="1" height="1" />
    <rect x="10" y="11" width="1" height="1" />
  </Icon>
);

export const SaveIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Floppy disk */}
    <rect x="2" y="2" width="12" height="10" />
    <rect x="3" y="3" width="10" height="8" fill="white" />
    <rect x="5" y="3" width="6" height="2" />
    <rect x="4" y="10" width="8" height="1" />
    <rect x="6" y="5" width="4" height="4" />
  </Icon>
);

export const CloseIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="2" y="7" width="12" height="2" />
    <rect x="7" y="2" width="2" height="12" />
    <rect x="3" y="3" width="2" height="2" />
    <rect x="11" y="3" width="2" height="2" />
    <rect x="3" y="11" width="2" height="2" />
    <rect x="11" y="11" width="2" height="2" />
  </Icon>
);

export const CheckIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="3" y="8" width="2" height="2" />
    <rect x="4" y="9" width="1" height="1" />
    <rect x="5" y="10" width="1" height="1" />
    <rect x="6" y="11" width="1" height="1" />
    <rect x="7" y="10" width="1" height="1" />
    <rect x="8" y="9" width="1" height="1" />
    <rect x="9" y="8" width="1" height="1" />
    <rect x="10" y="7" width="1" height="1" />
    <rect x="11" y="6" width="2" height="1" />
  </Icon>
);

export const ChevronRightIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="6" y="3" width="2" height="2" />
    <rect x="7" y="4" width="2" height="2" />
    <rect x="8" y="5" width="2" height="2" />
    <rect x="9" y="6" width="2" height="4" />
    <rect x="8" y="9" width="2" height="2" />
    <rect x="7" y="10" width="2" height="2" />
    <rect x="6" y="11" width="2" height="2" />
  </Icon>
);

export const ChevronLeftIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="8" y="3" width="2" height="2" />
    <rect x="7" y="4" width="2" height="2" />
    <rect x="6" y="5" width="2" height="2" />
    <rect x="5" y="6" width="2" height="4" />
    <rect x="6" y="9" width="2" height="2" />
    <rect x="7" y="10" width="2" height="2" />
    <rect x="8" y="11" width="2" height="2" />
  </Icon>
);

// ============ STATUS ICONS ============

export const IncomeIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="7" y="2" width="2" height="8" />
    <rect x="3" y="5" width="3" height="2" />
    <rect x="10" y="5" width="3" height="2" />
    <rect x="4" y="4" width="2" height="1" />
    <rect x="10" y="4" width="2" height="1" />
    <rect x="3" y="3" width="1" height="1" />
    <rect x="12" y="3" width="1" height="1" />
  </Icon>
);

export const ExpenseIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="7" y="6" width="2" height="8" />
    <rect x="3" y="9" width="3" height="2" />
    <rect x="10" y="9" width="3" height="2" />
    <rect x="4" y="10" width="2" height="1" />
    <rect x="10" y="10" width="2" height="1" />
    <rect x="3" y="11" width="1" height="1" />
    <rect x="12" y="11" width="1" height="1" />
  </Icon>
);

export const TransferIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="2" y="7" width="4" height="2" />
    <rect x="10" y="7" width="4" height="2" />
    <rect x="5" y="6" width="2" height="1" />
    <rect x="9" y="6" width="2" height="1" />
    <rect x="6" y="5" width="4" height="1" />
    <rect x="5" y="4" width="2" height="1" />
    <rect x="9" y="9" width="2" height="1" />
    <rect x="6" y="10" width="4" height="1" />
    <rect x="5" y="11" width="2" height="1" />
    <rect x="9" y="11" width="2" height="1" />
  </Icon>
);

export const SuccessIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="3" y="8" width="2" height="2" />
    <rect x="4" y="9" width="1" height="1" />
    <rect x="5" y="10" width="1" height="1" />
    <rect x="6" y="11" width="1" height="1" />
    <rect x="7" y="10" width="1" height="1" />
    <rect x="8" y="9" width="1" height="1" />
    <rect x="9" y="8" width="1" height="1" />
    <rect x="10" y="7" width="1" height="1" />
    <rect x="11" y="6" width="2" height="1" />
    {/* Circle outline */}
    <rect x="6" y="2" width="4" height="1" />
    <rect x="4" y="3" width="1" height="2" />
    <rect x="11" y="3" width="1" height="2" />
    <rect x="3" y="5" width="1" height="2" />
    <rect x="12" y="5" width="1" height="2" />
    <rect x="4" y="7" width="1" height="1" />
    <rect x="11" y="7" width="1" height="1" />
  </Icon>
);

export const WarningIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Triangle warning */}
    <rect x="7" y="2" width="2" height="1" />
    <rect x="6" y="3" width="4" height="1" />
    <rect x="5" y="4" width="6" height="1" />
    <rect x="4" y="5" width="8" height="1" />
    <rect x="3" y="6" width="10" height="1" />
    <rect x="3" y="7" width="10" height="3" />
    <rect x="4" y="10" width="8" height="1" />
    <rect x="5" y="11" width="6" height="1" />
    <rect x="6" y="12" width="4" height="1" />
    <rect x="7" y="13" width="2" height="1" />
    {/* Exclamation */}
    <rect x="7" y="6" width="2" height="2" fill="white" />
    <rect x="7" y="9" width="2" height="2" fill="white" />
  </Icon>
);

export const ErrorIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* X mark */}
    <rect x="3" y="3" width="2" height="2" />
    <rect x="4" y="4" width="1" height="1" />
    <rect x="5" y="5" width="1" height="1" />
    <rect x="6" y="6" width="1" height="1" />
    <rect x="7" y="7" width="2" height="2" />
    <rect x="9" y="6" width="1" height="1" />
    <rect x="10" y="5" width="1" height="1" />
    <rect x="11" y="4" width="1" height="1" />
    <rect x="11" y="3" width="2" height="2" />
    <rect x="11" y="11" width="2" height="2" />
    <rect x="10" y="10" width="1" height="1" />
    <rect x="9" y="9" width="1" height="1" />
    <rect x="8" y="8" width="1" height="1" />
    <rect x="7" y="7" width="2" height="2" />
    <rect x="5" y="9" width="1" height="1" />
    <rect x="4" y="10" width="1" height="1" />
    <rect x="3" y="11" width="2" height="2" />
  </Icon>
);

// ============ FINANCE ICONS ============

export const WalletIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="2" y="4" width="12" height="9" />
    <rect x="3" y="5" width="10" height="7" fill="white" />
    <rect x="10" y="6" width="2" height="3" />
    <rect x="4" y="7" width="4" height="1" />
    <rect x="4" y="9" width="3" height="1" />
  </Icon>
);

export const PiggyBankIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Piggy bank */}
    <rect x="5" y="4" width="7" height="6" />
    <rect x="4" y="5" width="1" height="4" />
    <rect x="12" y="6" width="1" height="2" />
    <rect x="11" y="5" width="1" height="1" />
    <rect x="13" y="5" width="1" height="1" />
    <rect x="13" y="7" width="1" height="1" />
    <rect x="4" y="4" width="2" height="1" />
    <rect x="5" y="3" width="2" height="1" />
    <rect x="4" y="9" width="1" height="1" />
    <rect x="11" y="9" width="2" height="1" />
    <rect x="5" y="10" width="6" height="1" />
    <rect x="4" y="11" width="7" height="1" />
    <rect x="3" y="10" width="1" height="1" />
    {/* Eye */}
    <rect x="6" y="6" width="1" height="1" fill="white" />
    <rect x="9" y="6" width="1" height="1" fill="white" />
  </Icon>
);

export const CreditCardIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="1" y="4" width="14" height="9" />
    <rect x="2" y="5" width="12" height="7" fill="white" />
    <rect x="2" y="7" width="6" height="2" />
    <rect x="10" y="10" width="3" height="1" />
  </Icon>
);

export const BankIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Bank building */}
    <rect x="6" y="2" width="4" height="2" />
    <rect x="4" y="4" width="8" height="2" />
    <rect x="2" y="6" width="12" height="1" />
    <rect x="3" y="7" width="2" height="5" />
    <rect x="6" y="7" width="1" height="5" />
    <rect x="9" y="7" width="2" height="5" />
    <rect x="11" y="7" width="2" height="5" />
    <rect x="3" y="12" width="10" height="1" />
    {/* Column details */}
    <rect x="3" y="8" width="1" height="1" />
    <rect x="6" y="8" width="1" height="1" />
    <rect x="9" y="8" width="1" height="1" />
    <rect x="11" y="8" width="1" height="1" />
  </Icon>
);

export const MoneyIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Money bag */}
    <rect x="5" y="2" width="6" height="3" />
    <rect x="6" y="5" width="4" height="2" />
    <rect x="4" y="6" width="8" height="5" />
    <rect x="5" y="7" width="6" height="3" fill="white" />
    <rect x="7" y="8" width="2" height="1" />
  </Icon>
);

export const CoinIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="4" y="2" width="8" height="1" />
    <rect x="3" y="3" width="10" height="1" />
    <rect x="2" y="4" width="12" height="1" />
    <rect x="2" y="5" width="1" height="6" />
    <rect x="3" y="5" width="10" height="6" fill="white" />
    <rect x="13" y="5" width="1" height="6" />
    <rect x="2" y="11" width="12" height="1" />
    <rect x="3" y="12" width="10" height="1" />
    <rect x="4" y="13" width="8" height="1" />
    {/* Dollar sign */}
    <rect x="7" y="6" width="2" height="1" />
    <rect x="7" y="8" width="2" height="1" />
    <rect x="7" y="10" width="2" height="1" />
    <rect x="6" y="7" width="1" height="1" />
    <rect x="9" y="7" width="1" height="1" />
    <rect x="6" y="9" width="1" height="1" />
    <rect x="9" y="9" width="1" height="1" />
  </Icon>
);

export const CalculatorIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="2" y="2" width="12" height="12" />
    <rect x="3" y="3" width="10" height="3" fill="white" />
    <rect x="3" y="7" width="3" height="2" />
    <rect x="7" y="7" width="3" height="2" />
    <rect x="11" y="7" width="2" height="2" />
    <rect x="3" y="10" width="3" height="2" />
    <rect x="7" y="10" width="3" height="2" />
    <rect x="11" y="10" width="2" height="4" />
    <rect x="3" y="13" width="7" height="1" />
  </Icon>
);

export const ChartIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="2" y="12" width="2" height="3" />
    <rect x="5" y="8" width="2" height="7" />
    <rect x="8" y="5" width="2" height="10" />
    <rect x="11" y="2" width="2" height="13" />
    <rect x="2" y="11" width="2" height="1" fill="white" />
    <rect x="5" y="7" width="2" height="1" fill="white" />
    <rect x="8" y="4" width="2" height="1" fill="white" />
    <rect x="11" y="1" width="2" height="1" fill="white" />
  </Icon>
);

// ============ CATEGORY ICONS ============

export const FoodIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Fork and knife / food */}
    <rect x="4" y="3" width="4" height="1" />
    <rect x="4" y="4" width="1" height="5" />
    <rect x="6" y="4" width="1" height="2" />
    <rect x="7" y="4" width="1" height="2" />
    <rect x="4" y="9" width="4" height="1" />
    <rect x="9" y="3" width="3" height="3" />
    <rect x="10" y="6" width="1" height="1" />
    <rect x="9" y="7" width="3" height="1" />
    <rect x="10" y="8" width="1" height="1" />
    <rect x="9" y="9" width="3" height="1" />
  </Icon>
);

export const TransportIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Car */}
    <rect x="2" y="6" width="12" height="5" />
    <rect x="4" y="4" width="8" height="2" />
    <rect x="5" y="5" width="2" height="1" fill="white" />
    <rect x="9" y="5" width="2" height="1" fill="white" />
    <rect x="3" y="8" width="3" height="2" />
    <rect x="10" y="8" width="3" height="2" />
    <rect x="4" y="11" width="2" height="2" />
    <rect x="10" y="11" width="2" height="2" />
    <rect x="4" y="12" width="2" height="1" fill="white" />
    <rect x="10" y="12" width="2" height="1" fill="white" />
  </Icon>
);

export const ShoppingIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Shopping bag */}
    <rect x="4" y="3" width="8" height="1" />
    <rect x="6" y="4" width="4" height="2" />
    <rect x="3" y="6" width="10" height="7" />
    <rect x="4" y="7" width="8" height="5" fill="white" />
    <rect x="5" y="8" width="6" height="1" />
  </Icon>
);

export const BillsIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Bill/receipt */}
    <rect x="3" y="2" width="10" height="12" />
    <rect x="4" y="3" width="8" height="10" fill="white" />
    <rect x="5" y="5" width="4" height="1" />
    <rect x="5" y="7" width="6" height="1" />
    <rect x="5" y="9" width="5" height="1" />
    <rect x="5" y="11" width="6" height="1" />
    {/* Torn edge */}
    <rect x="3" y="14" width="2" height="1" />
    <rect x="6" y="14" width="2" height="1" />
    <rect x="9" y="14" width="2" height="1" />
    <rect x="12" y="14" width="1" height="1" />
  </Icon>
);

export const EntertainmentIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Gamepad */}
    <rect x="3" y="5" width="10" height="6" />
    <rect x="4" y="6" width="8" height="4" fill="white" />
    <rect x="4" y="8" width="2" height="2" />
    <rect x="3" y="9" width="1" height="1" />
    <rect x="10" y="7" width="1" height="1" />
    <rect x="12" y="6" width="1" height="1" />
    <rect x="13" y="7" width="1" height="2" />
    <rect x="12" y="9" width="1" height="1" />
  </Icon>
);

export const HealthIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Medical cross */}
    <rect x="7" y="2" width="2" height="12" />
    <rect x="4" y="5" width="8" height="6" />
    <rect x="2" y="7" width="2" height="2" />
    <rect x="12" y="7" width="2" height="2" />
    <rect x="7" y="2" width="2" height="12" fill="white" />
    <rect x="4" y="5" width="8" height="6" />
  </Icon>
);

export const EducationIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Book */}
    <rect x="2" y="4" width="12" height="9" />
    <rect x="3" y="5" width="10" height="7" fill="white" />
    <rect x="2" y="4" width="1" height="9" />
    <rect x="8" y="6" width="4" height="1" />
    <rect x="8" y="8" width="4" height="1" />
    <rect x="8" y="10" width="3" height="1" />
  </Icon>
);

export const BeautyIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Lipstick/beauty */}
    <rect x="6" y="2" width="4" height="6" />
    <rect x="7" y="8" width="2" height="2" />
    <rect x="5" y="10" width="6" height="3" />
    <rect x="6" y="3" width="4" height="5" fill="white" />
    <rect x="7" y="10" width="2" height="1" fill="white" />
  </Icon>
);

export const OtherIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    {/* Dots/other */}
    <rect x="4" y="4" width="2" height="2" />
    <rect x="7" y="4" width="2" height="2" />
    <rect x="10" y="4" width="2" height="2" />
    <rect x="4" y="7" width="2" height="2" />
    <rect x="7" y="7" width="2" height="2" />
    <rect x="10" y="7" width="2" height="2" />
    <rect x="4" y="10" width="2" height="2" />
    <rect x="7" y="10" width="2" height="2" />
    <rect x="10" y="10" width="2" height="2" />
  </Icon>
);

// ============ MISC ICONS ============

export const UserIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="6" y="3" width="4" height="4" />
    <rect x="7" y="4" width="2" height="2" fill="white" />
    <rect x="4" y="8" width="8" height="2" />
    <rect x="3" y="10" width="10" height="3" />
    <rect x="5" y="10" width="6" height="1" fill="white" />
  </Icon>
);

export const SettingsIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="6" y="2" width="4" height="2" />
    <rect x="7" y="4" width="2" height="2" />
    <rect x="2" y="6" width="4" height="4" />
    <rect x="10" y="6" width="4" height="4" />
    <rect x="4" y="8" width="2" height="1" />
    <rect x="3" y="7" width="1" height="1" />
    <rect x="6" y="12" width="4" height="2" />
    <rect x="7" y="14" width="2" height="1" />
  </Icon>
);

export const NotificationIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="4" y="3" width="8" height="2" />
    <rect x="3" y="5" width="10" height="6" />
    <rect x="4" y="6" width="8" height="4" fill="white" />
    <rect x="7" y="7" width="2" height="2" />
    <rect x="6" y="11" width="1" height="1" />
    <rect x="9" y="11" width="1" height="1" />
    <rect x="5" y="12" width="6" height="1" />
    <rect x="6" y="13" width="4" height="1" />
    <rect x="10" y="2" width="2" height="2" />
    <rect x="11" y="3" width="1" height="1" fill="white" />
  </Icon>
);

export const CalendarIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="2" y="4" width="12" height="10" />
    <rect x="2" y="4" width="12" height="3" fill="currentColor" />
    <rect x="4" y="3" width="1" height="2" />
    <rect x="11" y="3" width="1" height="2" />
    <rect x="3" y="6" width="2" height="2" />
    <rect x="7" y="6" width="2" height="2" />
    <rect x="11" y="6" width="2" height="2" />
    <rect x="3" y="10" width="2" height="2" />
    <rect x="7" y="10" width="2" height="2" />
  </Icon>
);

export const RobotIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="5" y="2" width="6" height="5" />
    <rect x="6" y="3" width="1" height="1" fill="white" />
    <rect x="9" y="3" width="1" height="1" fill="white" />
    <rect x="6" y="5" width="4" height="1" fill="white" />
    <rect x="4" y="7" width="8" height="5" />
    <rect x="5" y="8" width="2" height="2" fill="white" />
    <rect x="9" y="8" width="2" height="2" fill="white" />
    <rect x="3" y="8" width="1" height="2" />
    <rect x="12" y="8" width="1" height="2" />
    <rect x="5" y="12" width="2" height="2" />
    <rect x="9" y="12" width="2" height="2" />
    <rect x="6" y="14" width="1" height="1" />
    <rect x="9" y="14" width="1" height="1" />
  </Icon>
);

export const ChatIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="2" y="3" width="10" height="7" />
    <rect x="3" y="4" width="8" height="5" fill="white" />
    <rect x="4" y="5" width="5" height="1" />
    <rect x="4" y="7" width="6" height="1" />
    <rect x="4" y="9" width="4" height="1" />
    <rect x="9" y="10" width="2" height="1" />
    <rect x="11" y="9" width="1" height="2" />
    <rect x="10" y="11" width="1" height="1" />
  </Icon>
);

export const LightbulbIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="5" y="2" width="6" height="1" />
    <rect x="4" y="3" width="8" height="1" />
    <rect x="4" y="4" width="1" height="5" />
    <rect x="11" y="4" width="1" height="5" />
    <rect x="5" y="4" width="6" height="6" />
    <rect x="6" y="5" width="4" height="4" fill="white" />
    <rect x="6" y="10" width="4" height="1" />
    <rect x="6" y="11" width="4" height="1" />
    <rect x="7" y="12" width="2" height="1" />
    <rect x="7" y="13" width="2" height="2" />
    <rect x="8" y="15" width="1" height="1" />
  </Icon>
);

export const StarIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="7" y="2" width="2" height="2" />
    <rect x="6" y="4" width="4" height="2" />
    <rect x="3" y="5" width="2" height="2" />
    <rect x="11" y="5" width="2" height="2" />
    <rect x="4" y="7" width="8" height="2" />
    <rect x="3" y="9" width="2" height="2" />
    <rect x="11" y="9" width="2" height="2" />
    <rect x="5" y="11" width="2" height="2" />
    <rect x="9" y="11" width="2" height="2" />
    <rect x="6" y="13" width="4" height="1" />
    <rect x="7" y="14" width="2" height="1" />
  </Icon>
);

export const TagIcon = ({ size, className, color }) => (
  <Icon size={size} className={className} color={color}>
    <rect x="2" y="4" width="10" height="8" />
    <rect x="12" y="5" width="2" height="2" />
    <rect x="14" y="7" width="1" height="1" />
    <rect x="13" y="8" width="1" height="1" />
    <rect x="12" y="9" width="1" height="1" />
    <rect x="3" y="5" width="8" height="6" fill="white" />
    <rect x="5" y="7" width="4" height="2" />
  </Icon>
);

export const BellIcon = NotificationIcon;
export const HomeFilledIcon = HomeIcon;
export const ChartBarIcon = ChartIcon;
export const GraphUpIcon = ChartIcon;
