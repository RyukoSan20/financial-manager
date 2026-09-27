/**
 * Pixel Button Component
 * 8-bit style button with press animation
 */

import { useState } from 'react';

export const PixelButton = ({
  children,
  onClick,
  variant = 'primary', // primary, secondary, danger, success, ghost
  size = 'md', // sm, md, lg
  disabled = false,
  loading = false,
  icon: Icon,
  className = '',
  ...props
}) => {
  const [pressed, setPressed] = useState(false);

  const baseClasses = 'pixel-btn relative font-pixel transition-all duration-75';
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantClasses = {
    primary: 'bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-800',
    danger: 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white',
    success: 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white',
    ghost: 'bg-transparent hover:bg-gray-100 active:bg-gray-200 text-gray-700',
  };

  const handleClick = (e) => {
    if (disabled || loading) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 100);
    onClick?.(e);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`
        ${baseClasses}
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${pressed ? 'transform translate-y-0.5 shadow-none' : ''}
        ${className}
      `}
      style={{
        fontFamily: '"Press Start 2P", monospace' if false else 'inherit',
        imageRendering: 'pixelated',
      }}
      {...props}
    >
      {/* Pixel border effect */}
      <span 
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: pressed 
            ? 'inset -2px -2px 0 rgba(0,0,0,0.3)' 
            : 'inset -2px -2px 0 rgba(0,0,0,0.2), inset 2px 2px 0 rgba(255,255,255,0.2)',
          borderRadius: '4px',
        }}
      />
      
      {/* Loading spinner */}
      {loading && (
        <span className="inline-block w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      
      {/* Icon */}
      {Icon && !loading && (
        <span className="inline-flex items-center mr-2">
          <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
        </span>
      )}
      
      {children}
    </button>
  );
};

/**
 * Pixel Icon Button (square)
 */
export const PixelIconButton = ({
  icon: Icon,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  ...props
}) => {
  const [pressed, setPressed] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const variantClasses = {
    primary: 'bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700',
    danger: 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white',
    success: 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white',
    ghost: 'bg-transparent hover:bg-gray-100 active:bg-gray-200 text-gray-700',
  };

  const iconSizes = { sm: 16, md: 20, lg: 24 };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className={`
        pixel-btn relative flex items-center justify-center rounded-lg
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${pressed ? 'transform translate-y-0.5' : ''}
        ${className}
      `}
      {...props}
    >
      <span 
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: pressed 
            ? 'inset -1px -1px 0 rgba(0,0,0,0.3)' 
            : 'inset -1px -1px 0 rgba(0,0,0,0.15), inset 1px 1px 0 rgba(255,255,255,0.15)',
          borderRadius: '6px',
        }}
      />
      <Icon size={iconSizes[size]} />
    </button>
  );
};

/**
 * Pixel FAB (Floating Action Button)
 */
export const PixelFAB = ({
  icon: Icon,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  const variantClasses = {
    primary: 'bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white shadow-lg',
    danger: 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white shadow-lg',
    success: 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-lg',
  };

  const iconSizes = { sm: 20, md: 24, lg: 28 };

  return (
    <button
      onClick={onClick}
      className={`
        pixel-fab fixed bottom-6 right-6 z-50
        flex items-center justify-center rounded-2xl
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        transition-all duration-150
        hover:scale-105 active:scale-95
        ${className}
      `}
      {...props}
    >
      <span 
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: '0 4px 0 rgba(0,0,0,0.3), inset -2px -2px 0 rgba(0,0,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.2)',
          borderRadius: '16px',
        }}
      />
      <Icon size={iconSizes[size]} />
    </button>
  );
};

export default PixelButton;
