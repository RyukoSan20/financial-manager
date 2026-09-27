/**
 * Pixel Progress Bar Component
 * 8-bit style progress indicator
 */

export const PixelProgress = ({
  value = 0,
  max = 100,
  size = 'md', // sm, md, lg
  variant = 'default', // default, success, warning, danger, gradient
  showLabel = false,
  label,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variantClasses = {
    default: 'bg-indigo-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    gradient: 'bg-gradient-to-r from-indigo-500 to-purple-500',
  };

  // Auto color based on percentage
  const autoVariant = percentage >= 100 ? 'danger' 
    : percentage >= 80 ? 'warning' 
    : variant === 'default' ? 'default' : variant;

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">{label || 'Progress'}</span>
          <span className="text-sm font-medium text-gray-700">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div 
        className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}
        style={{
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
        }}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${variantClasses[autoVariant]}`}
          style={{ 
            width: `${percentage}%`,
            boxShadow: '0 0 8px rgba(99, 102, 241, 0.5)' if autoVariant === 'default' : 'none',
          }}
        >
          {/* Pixel effect overlay */}
          <div 
            className="h-full w-full opacity-30"
            style={{
              background: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 8px)',
            }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Goal Progress Card
 */
export const GoalProgress = ({
  current,
  target,
  title,
  icon: Icon,
  deadline,
  className = '',
}) => {
  const percentage = Math.min(100, (current / target) * 100);
  const remaining = target - current;
  
  const formattedCurrency = (amount) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Icon size={20} />
          </div>
        )}
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">{title}</h4>
          {deadline && (
            <p className="text-xs text-gray-500">Target: {deadline}</p>
          )}
        </div>
        <span className={`
          text-sm font-bold px-2 py-1 rounded
          ${percentage >= 100 ? 'bg-emerald-100 text-emerald-700' :
            percentage >= 80 ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-700'}
        `}>
          {Math.round(percentage)}%
        </span>
      </div>
      
      <PixelProgress value={current} max={target} variant="default" />
      
      <div className="flex justify-between mt-2 text-sm">
        <span className="text-gray-500">
          {formattedCurrency(current)}
        </span>
        <span className="text-gray-500">
          {formattedCurrency(target)}
        </span>
      </div>
      
      {percentage < 100 && (
        <p className="text-xs text-gray-500 mt-2">
          Sisa: {formattedCurrency(remaining)}
        </p>
      )}
    </div>
  );
};

/**
 * Budget Progress Bar
 */
export const BudgetProgress = ({
  spent,
  budget,
  category,
  className = '',
}) => {
  const percentage = (spent / budget) * 100;
  const variant = percentage >= 100 ? 'danger' 
    : percentage >= 80 ? 'warning' 
    : 'success';
    
  const formatted = (amount) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{category}</span>
        <span className="text-sm text-gray-500">
          {formatted(spent)} / {formatted(budget)}
        </span>
      </div>
      <PixelProgress value={spent} max={budget} variant={variant} />
      {percentage >= 100 && (
        <p className="text-xs text-red-600 mt-1 font-medium">
          ⚠️ Budget melebihi batas!
        </p>
      )}
    </div>
  );
};

/**
 * Debt Progress Bar
 */
export const DebtProgress = ({
  paid,
  total,
  creditor,
  className = '',
}) => {
  const percentage = (paid / total) * 100;
  const remaining = total - paid;
  
  const formatted = (amount) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{creditor}</span>
        <span className="text-sm font-medium text-emerald-600">
          {Math.round(percentage)}% lunas
        </span>
      </div>
      <PixelProgress value={paid} max={total} variant="success" />
      <p className="text-xs text-gray-500 mt-2">
        Sisa: {formatted(remaining)}
      </p>
    </div>
  );
};

export default PixelProgress;
