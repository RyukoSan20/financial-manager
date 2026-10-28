/**
 * Pixel Badge Component
 * 8-bit style status badges and tags
 */

import { useTranslation } from '../../i18n';
import { batch3 } from '../../i18n/keys_batch3';
import { isIncoming, isOutgoing } from '../../utils/transactionSign';

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
    info: 'bg-primary-100 text-primary-700',
    purple: 'bg-purple-100 text-purple-700',
    income: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
    expense: 'bg-red-100 text-red-700 border border-red-300',
    pending: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
    paid: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
    failed: 'bg-red-100 text-red-700 border border-red-300',
    recurring: 'bg-primary-100 text-primary-700 border border-primary-300',
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
  const { language } = useTranslation();
  const labels = batch3[language]?.categories || {};

  // The colour and the shape of the badge do not change with the
  // language. Only the name on it does.
  const categoryConfig = {
    food_beverages: { variant: 'warning', color: '#F59E0B' },
    transport: { variant: 'info', color: '#3B82F6' },
    shopping: { variant: 'purple', color: '#8B5CF6' },
    bills_utilities: { variant: 'danger', color: '#EF4444' },
    entertainment: { variant: 'purple', color: '#EC4899' },
    health: { variant: 'success', color: '#10B981' },
    education: { variant: 'info', color: '#06B6D4' },
    beauty: { variant: 'purple', color: '#F472B6' },
    salary: { variant: 'success', color: '#10B981' },
    freelance: { variant: 'success', color: '#22C55E' },
    investment: { variant: 'success', color: '#14B8A6' },
    gift: { variant: 'success', color: '#34D399' },
    other: { variant: 'default', color: '#6B7280' },
  };

  const config = categoryConfig[category] || categoryConfig.other;

  return (
    <PixelBadge
      variant={config.variant}
      size={size}
      className={className}
    >
      {labels[category] || labels.other}
    </PixelBadge>
  );
};

/**
 * Account Type Badge
 */
export const AccountTypeBadge = ({ type, size = 'sm', className = '' }) => {
  const { language } = useTranslation();
  const labels = batch3[language]?.account_types || {};

  const typeConfig = {
    bank: { variant: 'info' },
    ewallet: { variant: 'warning' },
    cash: { variant: 'default' },
    credit_card: { variant: 'danger' },
    savings: { variant: 'success' },
  };

  const config = typeConfig[type] || typeConfig.cash;

  return (
    <PixelBadge variant={config.variant} size={size} className={className}>
      {labels[type] || labels.other}
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
  const { language } = useTranslation();
  const K = batch3[language]?.pixel_badge;
  if (isIncoming(type)) {
    return (
      <PixelBadge variant="income" size={size} className={className}>
        ↑ {K.income}
      </PixelBadge>
    );
  }
  if (isOutgoing(type)) {
    return (
      <PixelBadge variant="expense" size={size} className={className}>
        ↓ {K.expense}
      </PixelBadge>
    );
  }
  return (
    <PixelBadge variant="default" size={size} className={className}>
      {K.transfer}
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
  const isPositive = isIncoming(type);
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
