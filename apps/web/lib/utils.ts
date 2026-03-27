import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number in Indian style — 1,00,000 */
export function formatIndian(n: number | string): string {
  const num = Number(n)
  if (isNaN(num)) return String(n)
  return new Intl.NumberFormat('en-IN').format(num)
}

/** Format as INR currency */
export function formatINR(n: number | string): string {
  const num = Number(n)
  if (isNaN(num)) return String(n)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num)
}

/** Convert number to lakh/crore shorthand */
export function toIndianShort(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)} Cr`
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)} L`
  return formatINR(n)
}

/** Truncate long strings */
export function truncate(s: string, max = 60): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

/** Format milliseconds as human-readable */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** Generate a short random ID for messages */
export function nanoid(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Detect if a value looks like a number */
export function isNumeric(v: unknown): boolean {
  return !isNaN(Number(v)) && v !== null && v !== ''
}

/** Connector display names and colors */
export const CONNECTOR_META: Record<string, { label: string; color: string; icon: string }> = {
  postgresql:  { label: 'PostgreSQL',   color: 'bg-blue-100 text-blue-700',    icon: '🐘' },
  mysql:       { label: 'MySQL',        color: 'bg-orange-100 text-orange-700', icon: '🐬' },
  google_sheets:{ label: 'Google Sheets',color: 'bg-green-100 text-green-700', icon: '📊' },
  tally:       { label: 'Tally',        color: 'bg-purple-100 text-purple-700', icon: '📒' },
  zoho_crm:    { label: 'Zoho CRM',     color: 'bg-red-100 text-red-700',       icon: '👥' },
  zoho_books:  { label: 'Zoho Books',   color: 'bg-yellow-100 text-yellow-700', icon: '📚' },
}