/**
 * Currency-aware Number Input Component
 * - IDR: 10,000 (no decimals)
 * - USD/EUR: 10,000.00 (2 decimals)
 * - JPY: 10,000 (no decimals)
 * Auto-format on blur, raw number on focus
 */
import { useState, useRef, useEffect } from 'react';

const DECIMAL_CONFIG = {
  IDR: { decimals: 0, separator: '.', thousandsSeparator: ',' },
  USD: { decimals: 2, separator: '.', thousandsSeparator: ',' },
  EUR: { decimals: 2, separator: ',', thousandsSeparator: '.' },
  GBP: { decimals: 2, separator: '.', thousandsSeparator: ',' },
  JPY: { decimals: 0, separator: '.', thousandsSeparator: ',' },
  AUD: { decimals: 2, separator: '.', thousandsSeparator: ',' },
  SGD: { decimals: 2, separator: '.', thousandsSeparator: ',' },
  CNY: { decimals: 2, separator: '.', thousandsSeparator: ',' },
  MYR: { decimals: 2, separator: '.', thousandsSeparator: ',' },
  THB: { decimals: 2, separator: '.', thousandsSeparator: ',' },
  KRW: { decimals: 0, separator: '.', thousandsSeparator: ',' },
  PHP: { decimals: 2, separator: '.', thousandsSeparator: ',' },
  VND: { decimals: 0, separator: '.', thousandsSeparator: ',' },
  default: { decimals: 2, separator: '.', thousandsSeparator: ',' },
};

const CURRENCY_SYMBOLS = {
  IDR: 'Rp',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  SGD: 'S$',
  CNY: '¥',
  MYR: 'RM',
  THB: '฿',
  KRW: '₩',
  PHP: '₱',
  VND: '₫',
};

export function getDecimalConfig(currency) {
  return DECIMAL_CONFIG[currency] || DECIMAL_CONFIG.default;
}

export function getCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export function formatNumber(value, currency = 'IDR') {
  if (value === null || value === undefined || value === '') return '';
  
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  if (isNaN(num)) return '';
  
  const config = getDecimalConfig(currency);
  const fixed = num.toFixed(config.decimals);
  const [intPart, decPart] = fixed.split('.');
  
  // Format with thousands separator
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);
  
  if (config.decimals > 0 && decPart) {
    return formatted + config.separator + decPart;
  }
  return formatted;
}

export function parseFormattedNumber(value) {
  if (!value) return 0;
  // Remove all non-numeric except decimal separator and minus
  const cleaned = value.replace(/[^\d.,\-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export default function CurrencyInput({
  value = 0,
  onChange,
  currency = 'IDR',
  placeholder,
  label,
  error,
  disabled = false,
  showSymbol = true,
  min = 0,
  max,
  className = '',
  ...props
}) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  
  const symbol = getCurrencySymbol(currency);
  const config = getDecimalConfig(currency);
  
  // Sync display value when value changes externally
  useEffect(() => {
    if (!isFocused && value !== undefined && value !== null) {
      setDisplayValue(formatNumber(value, currency));
    }
  }, [value, currency, isFocused]);
  
  // Initialize display value
  useEffect(() => {
    if (value !== undefined && value !== null && !isFocused) {
      setDisplayValue(formatNumber(value, currency));
    }
  }, []);
  
  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number for editing
    if (value !== undefined && value !== null) {
      setDisplayValue(value.toString());
    }
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    const numValue = parseFormattedNumber(displayValue);
    const clampedValue = min !== undefined ? Math.max(min, numValue) : numValue;
    if (max !== undefined) {
      setDisplayValue(formatNumber(Math.min(max, clampedValue), currency));
    } else {
      setDisplayValue(formatNumber(clampedValue, currency));
    }
    onChange?.(clampedValue);
  };
  
  const handleChange = (e) => {
    const input = e.target.value;
    // Allow: digits, decimal separators, minus
    const cleaned = input.replace(/[^\d.,\-]/g, '');
    setDisplayValue(cleaned);
    
    // Parse and emit onChange for real-time updates
    const numValue = parseFormattedNumber(cleaned);
    if (!isNaN(numValue)) {
      onChange?.(numValue);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };
  
  return (
    <div className={`currency-input-wrapper ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {showSymbol && (
          <span className="absolute left-3 text-gray-500 dark:text-gray-400 font-medium">
            {symbol}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '0'}
          disabled={disabled}
          className={`
            w-full px-3 py-2 
            ${showSymbol ? 'pl-8' : ''} 
            border rounded-lg
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 dark:disabled:bg-gray-700
            disabled:cursor-not-allowed
            ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
            transition-colors
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Format: {config.decimals > 0 ? `1${config.thousandsSeparator}234${config.thousandsSeparator}567${config.separator}89` : `1${config.thousandsSeparator}234${config.thousandsSeparator}567`}
      </p>
    </div>
  );
}

// Standalone number input without currency symbol
export function NumberInput({
  value = 0,
  onChange,
  currency = 'IDR',
  placeholder,
  label,
  error,
  disabled = false,
  min = 0,
  max,
  className = '',
  ...props
}) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  
  const config = getDecimalConfig(currency);
  
  useEffect(() => {
    if (!isFocused && value !== undefined && value !== null) {
      setDisplayValue(formatNumber(value, currency));
    }
  }, [value, currency, isFocused]);
  
  useEffect(() => {
    if (value !== undefined && value !== null && !isFocused) {
      setDisplayValue(formatNumber(value, currency));
    }
  }, []);
  
  const handleFocus = () => {
    setIsFocused(true);
    if (value !== undefined && value !== null) {
      setDisplayValue(value.toString());
    }
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    const numValue = parseFormattedNumber(displayValue);
    const clampedValue = min !== undefined ? Math.max(min, numValue) : numValue;
    if (max !== undefined) {
      setDisplayValue(formatNumber(Math.min(max, clampedValue), currency));
    } else {
      setDisplayValue(formatNumber(clampedValue, currency));
    }
    onChange?.(clampedValue);
  };
  
  const handleChange = (e) => {
    const input = e.target.value;
    const cleaned = input.replace(/[^\d.,\-]/g, '');
    setDisplayValue(cleaned);
    const numValue = parseFormattedNumber(cleaned);
    if (!isNaN(numValue)) {
      onChange?.(numValue);
    }
  };
  
  return (
    <div className={`number-input-wrapper ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder || '0'}
        disabled={disabled}
        className={`
          w-full px-3 py-2 
          border rounded-lg
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-white
          placeholder-gray-400 dark:placeholder-gray-500
          focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          disabled:bg-gray-100 dark:disabled:bg-gray-700
          disabled:cursor-not-allowed
          ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
          transition-colors
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
