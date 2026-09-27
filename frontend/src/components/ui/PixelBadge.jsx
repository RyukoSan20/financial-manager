/**
 * Pixel Badge Component
 * 8-bit style status badges and tags
 */

export const PixelBadge = ({
  children,
  variant = 'default', // default, success, warning, danger, info, purple, income, expense
  size = 'md', // sm, md, lg
  icon: Icon,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[8px]',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const variantClasses = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    income: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
    expense: 'bg-red-100 text-red-700 border border-red-300',
    pending: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
    paid: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
    failed: 'bg-red-100 text-red-700 border border-red-300',
    recurring: 'bg-blue-100 text-blue-700 border border-blue-300',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1
        font-medium rounded
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      style={{
        fontFamily: 'monospace',
        letterSpacing: '0.02em',
      }}
    >
      {Icon && <Icon size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12} />}
      {children}
    </span>
  );
};

/**
 * Category Badge - Transaction categories
 */
export const CategoryBadge = ({ category, size = 'md', className = '' }) => {
  const categoryConfig = {
    food_beverages: { label: 'Makanan', variant: 'warning', color: '#F59E0B' },
    transport: { label: 'Transport', variant: 'info', color: '#3B82F6' },
    shopping: { label: 'Belanja', variant: 'purple', color: '#8B5CF6' },
    bills_utilities: { label: 'Tagihan', variant: 'danger', color: '#EF4444' },
    entertainment: { label: 'Hiburan', variant: 'purple', color: '#EC4899' },
    health: { label: 'Kesehatan', variant: 'success', color: '#10B981' },
    education: { label: 'Pendidikan', variant: 'info', color: '#06B6D4' },
    beauty: { label: 'Kecantikan', variant: 'purple', color: '#F472B6' },
    salary: { label: 'Gaji', variant: 'success', color: '#10B981' },
    freelance: { label: 'Freelance', variant: 'success', color: '#22C55E' },
    investment: { label: 'Investasi', variant: 'success', color: '#14B8A6' },
    gift: { label: 'Hadiah', variant: 'success', color: '#34D399' },
    other: { label: 'Lainnya', variant: 'default', color: '#6B7280' },
  };

  const config = categoryConfig[category] || categoryConfig.other;

  return (
    <PixelBadge
      variant={config.variant}
      size={size}
      className={className}
    >
      {config.label}
    </PixelBadge>
  );
};

/**
 * Account Type Badge
 */
export const AccountTypeBadge = ({ type, size = 'sm', className = '' }) => {
  const typeConfig = {
    bank: { label: 'Bank', variant: 'info' },
    ewallet: { label: 'E-Wallet', variant: 'warning' },
    cash: { label: 'Tunai', variant: 'default' },
    credit_card: { label: 'Kartu Kredit', variant: 'danger' },
    savings: { label: 'Tabungan', variant: 'success' },
  };

  const config = typeConfig[type] || typeConfig.cash;

  return (
    <PixelBadge variant={config.variant} size={size} className={className}>
      {config.label}
    </PixelBadge>
  );
};

/**
 * Status Indicator Dot
 */
export const StatusDot = ({
  status, // online, offline, pending, success, error, warning
  size = 'md',
  pulse = false,
  className = '',
}) => {
  const colors = {
    online: 'bg-emerald-500',
    success: 'bg-emerald-500',
    pending: 'bg-yellow-500',
    warning: 'bg-amber-500',
    offline: 'bg-gray-400',
    error: 'bg-red-500',
  };

  const sizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  return (
    <span
      className={`
        inline-block rounded-full
        ${sizes[size]}
        ${colors[status]}
        ${pulse ? 'animate-pulse' : ''}
        ${className}
      `}
    />
  );
};

/**
 * Transaction Type Badge (Income/Expense)
 */
export const TransactionTypeBadge = ({ type, size = 'md', className = '' }) => {
  if (type === 'income') {
    return (
      <PixelBadge variant="income" size={size} className={className}>
        ↑ Masuk
      </PixelBadge>
    );
  }
  if (type === 'expense') {
    return (
      <PixelBadge variant="expense" size={size} className={className}>
        ↓ Keluar
      </PixelBadge>
    );
  }
  return (
    <PixelBadge variant="default" size={size} className={className}>
      Transfer
    </PixelBadge>
  );
};

/**
 * Progress Badge - Shows percentage
 */
export const ProgressBadge = ({ value, size = 'md', className = '' }) => {
  let variant = 'success';
  if (value >= 100) variant = 'danger';
  else if (value >= 80) variant = 'warning';

  return (
    <PixelBadge variant={variant} size={size} className={className}>
      {Math.min(100, Math.round(value))}%
    </PixelBadge>
  );
};

/**
 * Date Tag - Compact date display
 */
export const DateTag = ({ date, size = 'sm', className = '' }) => {
  const formatDate = (d) => {
    const parsed = new Date(d);
    const now = new Date();
    const diff = Math.floor((now - parsed) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return 'Hari ini';
    if (diff === 1) return 'Kemarin';
    if (diff < 7) return `${diff} hari`;
    
    return parsed.toLocaleDateString('id-ID', { 
      day: '2-digit', 
      month: 'short' 
    });
  };

  return (
    <PixelBadge variant="default" size={size} className={className}>
      {formatDate(date)}
    </PixelBadge>
  );
};

/**
 * Amount Tag - Formatted amount with color
 */
export const AmountTag = ({ amount, type, size = 'md', className = '' }) => {
  const isPositive = type === 'income';
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Math.abs(amount));

  return (
    <span
      className={`
        font-bold font-mono
        ${isPositive ? 'text-emerald-600' : 'text-red-600'}
        ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'}
        ${className}
      `}
    >
      {isPositive ? '+' : '-'}{formatted}
    </span>
  );
};

export default PixelBadge;
