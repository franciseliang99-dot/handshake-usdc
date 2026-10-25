import { useReadContract } from 'wagmi'
import { HANDSHAKE_ABI, JobTuple } from '../contracts/handshake'
import { formatUsdc, formatAddress, countdown } from '../lib/format'
import { useChain } from '../hooks/useChain'
import { useNow } from '../hooks/useNow'
import StatusBadge from './StatusBadge'

interface Props {
  jobId: bigint
  role?: 'buyer' | 'seller'
  onClick: () => void
}

export default function JobCard({ jobId, role, onClick }: Props) {
  // All hooks must be called unconditionally before any early return
  const { chainId, isDeployed, handshakeAddress } = useChain()
  const { data: job } = useReadContract({
    address: handshakeAddress as `0x${string}` | undefined,
    abi: HANDSHAKE_ABI,
    functionName: 'getJob',
    args: [jobId],
    chainId,
    query: { enabled: isDeployed && !!handshakeAddress },
  })
  const now = useNow()

  const j = job as JobTuple | undefined
  if (!j) {
    return (
      <div
        className="animate-pulse rounded-2xl p-4"
        style={{ background: 'var(--surface-muted)', height: '80px' }}
      />
    )
  }

  const isActive = j.status < 2

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: 'var(--surface-strong)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="mono text-xs" style={{ color: 'var(--muted)' }}>#{jobId.toString()}</span>
            {role && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: 'var(--surface-muted)', color: 'var(--subtle)' }}>
                as {role}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {j.description || '(no description)'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <span>{formatAddress(j.buyer)} → {formatAddress(j.seller)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={j.status} />
          <span className="display text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {formatUsdc(j.amount)} USDC
          </span>
          {isActive && (
            <span className="text-xs" style={{ color: now > j.deadline ? 'var(--danger)' : 'var(--muted)' }}>
              {now > j.deadline ? 'deadline passed' : `deadline ${countdown(j.deadline)}`}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
