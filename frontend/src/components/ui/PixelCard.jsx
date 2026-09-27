/**
 * Pixel Card Component
 * 8-bit style card with pixel border effect
 */

export const PixelCard = ({
  children,
  variant = 'default', // default, elevated, outlined, flat
  padding = 'md', // sm, md, lg, none
  className = '',
  onClick,
  ...props
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const variantClasses = {
    default: 'bg-white shadow-sm',
    elevated: 'bg-white shadow-md',
    outlined: 'bg-white border-2 border-gray-200',
    flat: 'bg-gray-50',
  };

  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl
        ${paddingClasses[padding]}
        ${variantClasses[variant]}
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
        ${className}
      `}
      style={{
        boxShadow: variant === 'elevated' 
          ? '0 4px 0 rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.1)'
          : variant === 'default'
          ? '0 2px 0 rgba(0,0,0,0.03), 0 1px 4px rgba(0,0,0,0.05)'
          : 'none',
      }}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * Pixel Card Header
 */
export const PixelCardHeader = ({
  children,
  title,
  subtitle,
  icon: Icon,
  action,
  className = '',
}) => (
  <div className={`flex items-center justify-between mb-3 ${className}`}>
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
          <Icon size={20} />
        </div>
      )}
      <div>
        {title && (
          <h3 className="font-semibold text-gray-900">{title}</h3>
        )}
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
        {children}
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

/**
 * Pixel Card Body
 */
export const PixelCardBody = ({
  children,
  className = '',
}) => (
  <div className={className}>
    {children}
  </div>
);

/**
 * Pixel Card Footer
 */
export const PixelCardFooter = ({
  children,
  className = '',
}) => (
  <div className={`mt-4 pt-3 border-t border-gray-100 ${className}`}>
    {children}
  </div>
);

/**
 * Stat Card - For dashboard stats
 */
export const StatCard = ({
  title,
  value,
  change,
  changeType, // positive, negative, neutral
  icon: Icon,
  iconColor = 'indigo',
  className = '',
}) => {
  const iconColors = {
    indigo: 'bg-indigo-100 text-indigo-600',
    green: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-amber-100 text-amber-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <PixelCard variant="outlined" className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-xs mt-1 ${
              changeType === 'positive' ? 'text-emerald-600' :
              changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {changeType === 'positive' && '↑ '}
              {changeType === 'negative' && '↓ '}
              {change}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColors[iconColor]}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </PixelCard>
  );
};

/**
 * Empty State Card
 */
export const EmptyStateCard = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => (
  <PixelCard variant="flat" padding="lg" className={`text-center ${className}`}>
    {Icon && (
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-400">
        <Icon size={32} />
      </div>
    )}
    <h3 className="font-semibold text-gray-700 mb-2">{title}</h3>
    {description && (
      <p className="text-sm text-gray-500 mb-4 max-w-xs mx-auto">{description}</p>
    )}
    {action}
  </PixelCard>
);

export default PixelCard;
