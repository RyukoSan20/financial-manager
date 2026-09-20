import { clsx } from 'clsx';

export const Input = ({ 
  label, 
  error, 
  className, 
  type = 'text',
  ...props 
}) => (
  <div className="w-full">
    {label && (
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
    )}
    <input
      type={type}
      className={clsx(
        'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
        error ? 'border-danger-500' : 'border-gray-300',
        className
      )}
      {...props}
    />
    {error && <p className="mt-1 text-sm text-danger-500">{error}</p>}
  </div>
);
