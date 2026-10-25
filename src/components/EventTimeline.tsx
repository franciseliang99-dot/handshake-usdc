import { JobEvent } from '../hooks/useJobEvents'
import { formatAddress } from '../lib/format'
import { buildTxExplorerUrl } from '../onchain-facts'
import { ExternalLink } from 'lucide-react'

const EVENT_ICONS: Record<string, string> = {
  JobOpened: '📋',
  JobDelivered: '📦',
  JobReleased: '✅',
  JobRefunded: '↩',
  JobDisputed: '⚠',
  JobSettled: '⚖',
  SplitProposed: '🤝',
  FundsClaimable: '💰',
  Claimed: '💸',
}

function renderArg(key: string, val: unknown): string {
  if (typeof val === 'bigint') {
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('share')) {
      return `${(Number(val) / 1_000_000).toFixed(2)} USDC`
    }
    if (key.toLowerCase().includes('at') || key.toLowerCase().includes('deadline')) {
      return new Date(Number(val) * 1000).toLocaleString()
    }
    return val.toString()
  }
  if (typeof val === 'string' && val.startsWith('0x') && val.length === 42) {
    return formatAddress(val)
  }
  return String(val)
}

interface Props {
  events: JobEvent[]
  loading: boolean
}

export default function EventTimeline({ events, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--surface-muted)' }} />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--muted)' }}>No events yet.</p>
    )
  }

  return (
    <div className="relative space-y-0">
      {events.map((ev, i) => (
        <div key={`${ev.txHash}-${i}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm"
              style={{ background: 'var(--surface-muted)', border: '2px solid var(--border)' }}
            >
              {EVENT_ICONS[ev.name] ?? '·'}
            </div>
            {i < events.length - 1 && (
              <div className="my-0.5 w-px flex-1" style={{ background: 'var(--border)', minHeight: '16px' }} />
            )}
          </div>
          <div className="min-w-0 flex-1 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{ev.name}</span>
              <a
                href={buildTxExplorerUrl(5042002, ev.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-xs"
                style={{ color: 'var(--accent-hover)' }}
              >
                Block #{ev.blockNumber.toString()} <ExternalLink className="size-3" />
              </a>
            </div>
            <dl className="mt-1 space-y-0.5">
              {Object.entries(ev.args)
                .filter(([k]) => k !== 'jobId')
                .map(([k, v]) => (
                  <div key={k} className="flex gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                    <dt className="font-medium" style={{ color: 'var(--subtle)' }}>{k}:</dt>
                    <dd className="mono break-all">{renderArg(k, v)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      ))}
    </div>
  )
}
