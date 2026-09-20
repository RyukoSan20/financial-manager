import { clsx } from 'clsx';

export const StatCard = ({ label, value, change, changeType, icon, className }) => (
  <div className={clsx('p-4', className)}>
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-500">{label}</p>
      {icon && <span className="text-gray-400">{icon}</span>}
    </div>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    {change !== undefined && (
      <p className={clsx('text-sm mt-1', changeType === 'up' ? 'text-success-600' : changeType === 'down' ? 'text-danger-600' : 'text-gray-500')}>
        {changeType === 'up' && '+'}
        {change}
      </p>
    )}
  </div>
);
