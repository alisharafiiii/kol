import { nanoid } from 'nanoid'

/**
 * Generate a unique ID
 */
export function generateId(prefix?: string): string {
  const id = nanoid()
  return prefix ? `${prefix}_${id}` : id
}

/**
 * Format date to a readable string
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

/**
 * Truncate text to a specific length
 */
export function truncateText(text: string, length: number): string {
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}

/**
 * Class names helper
 */
export function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(' ')
} 