const formatters: Record<string, Intl.NumberFormat> = {
  VND: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
}

/**
 * Format số tiền (cents) thành chuỗi tiền tệ.
 * VND: 150000000 cents → "1.500.000 ₫"
 * USD: 150000 cents → "$1,500.00"
 */
export function formatCurrency(amountCents: number, currency = 'VND'): string {
  const formatter = formatters[currency] ?? formatters['VND']
  // VND không có đơn vị nhỏ hơn đồng → chia 100 rồi format
  return formatter.format(amountCents / 100)
}

/**
 * Format ngày ISO/YYYY-MM-DD sang dd/MM/yyyy (locale VN)
 * "2026-03-01" → "01/03/2026"
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString.length === 10 ? `${dateString}T00:00:00` : dateString)
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
