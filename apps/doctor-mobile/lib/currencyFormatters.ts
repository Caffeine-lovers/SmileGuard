/**
 * Utility functions for currency and numeric formatting in SmileGuard.
 * Ensures numbers always have thousand comma separators and exactly two decimal places (hundredths),
 * regardless of platform or engine locale quirks (e.g. Android Hermes/JSC).
 */

/**
 * Formats a number or numeric string as Philippine Peso currency
 * with comma thousand separators and exactly two decimal places (hundredths).
 * 
 * @example
 * formatCurrency(1500)       // "₱1,500.00"
 * formatCurrency("1500000")  // "₱1,500,000.00"
 * formatCurrency(12.5)       // "₱12.50"
 * formatCurrency(0)          // "₱0.00"
 * formatCurrency(-350)       // "-₱350.00"
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₱0.00';
  const num = typeof amount === 'number'
    ? amount
    : parseFloat(String(amount).replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return '₱0.00';

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const [intPart, decPart = '00'] = absNum.toFixed(2).split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNegative ? '-' : ''}₱${withCommas}.${decPart}`;
}

/**
 * Formats a number or numeric string with comma thousand separators and two decimal places,
 * without the currency symbol prefix.
 *
 * @example
 * formatNumberWithCommas(1500)      // "1,500.00"
 * formatNumberWithCommas("1250000") // "1,250,000.00"
 */
export function formatNumberWithCommas(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '0.00';
  const num = typeof amount === 'number'
    ? amount
    : parseFloat(String(amount).replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return '0.00';

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const [intPart, decPart = '00'] = absNum.toFixed(2).split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNegative ? '-' : ''}${withCommas}.${decPart}`;
}

/**
 * Safely parses any currency string (including commas and symbols) into a raw float.
 * Prevents standard parseFloat from cutting off at the first comma (e.g. parseFloat("1,500") -> 1).
 *
 * @example
 * parseCurrencyInput("1,500.50") // 1500.50
 * parseCurrencyInput("₱25,000")  // 25000
 */
export function parseCurrencyInput(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const cleaned = String(value).replace(/,/g, '').replace(/[^0-9.-]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
