/** Format a 6-decimal USDC bigint as a human-readable string */
export function formatUsdc(raw: bigint): string {
  const n = Number(raw) / 1_000_000
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

/** Parse a human-readable USDC string to a 6-decimal bigint */
export function parseUsdc(val: string): bigint {
  const n = parseFloat(val)
  if (isNaN(n) || n <= 0) throw new Error('Invalid USDC amount')
  return BigInt(Math.round(n * 1_000_000))
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

export function formatDeadline(unix: bigint): string {
  const d = new Date(Number(unix) * 1000)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function countdown(unix: bigint): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = Number(unix) - now
  if (diff <= 0) return 'elapsed'
  return formatDuration(diff)
}

export function parseOnchainError(error: unknown): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('user denied')) return 'Transaction cancelled.'
  if (msg.includes('insufficient')) return 'Insufficient USDC balance. Approve or add funds first.'
  if (msg.includes('deadlinepassed')) return 'Job deadline has already passed.'
  if (msg.includes('dealdlinenotreached')) return 'Deadline not yet reached.'
  if (msg.includes('reviewwindowelapsed')) return 'Review window has closed.'
  if (msg.includes('reviewwindownotelapsed')) return 'Review window has not elapsed yet.'
  if (msg.includes('notbuyer')) return 'Only the buyer can do this.'
  if (msg.includes('notseller')) return 'Only the seller can do this.'
  if (msg.includes('notarbiter')) return 'Only the arbiter can do this.'
  if (msg.includes('invalidstatus')) return 'Job is not in the right state for this action.'
  if (msg.includes('nothingtoclaim')) return 'Nothing to claim.'
  if (msg.includes('reverted')) return 'Transaction reverted. Check job state.'
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error. Try again.'
  return 'Something went wrong. Try again.'
}
