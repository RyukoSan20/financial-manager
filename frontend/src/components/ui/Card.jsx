import { clsx } from 'clsx';

export const Card = ({ children, className, hover = false, onClick, ...props }) => (
  <div
    className={clsx(
      'bg-white rounded-xl shadow-sm border border-gray-100',
      hover && 'card-hover cursor-pointer',
      className
    )}
    onClick={onClick}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className, ...props }) => (
  <div className={clsx('px-5 py-4 border-b border-gray-100', className)} {...props}>
    {children}
  </div>
);

export const CardBody = ({ children, className, ...props }) => (
  <div className={clsx('px-5 py-4', className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className, ...props }) => (
  <div className={clsx('px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl', className)} {...props}>
    {children}
  </div>
);
