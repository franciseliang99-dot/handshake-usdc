import { useReadContract } from 'wagmi'
import { useState, useEffect } from 'react'
import { ExternalLink, Copy, CheckCheck } from 'lucide-react'
import { HANDSHAKE_ABI, JobTuple, JOB_STATUS_LABELS } from '../contracts/handshake'
import { formatUsdc, formatAddress, formatDeadline, countdown } from '../lib/format'
import { useNow } from '../hooks/useNow'
import { useJobEvents } from '../hooks/useJobEvents'
import { useChain } from '../hooks/useChain'
import EventTimeline from './EventTimeline'
import StatusBadge from './StatusBadge'
import JobActions from './JobActions'
import { buildShareLink } from '../lib/share'

interface Props {
  jobId: bigint
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs font-semibold uppercase tracking-wider shrink-0" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <span className={`text-sm text-right break-all ${mono ? 'mono' : ''}`} style={{ color: 'var(--ink-2)' }}>
        {value}
      </span>
    </div>
  )
}

export default function JobPage({ jobId }: Props) {
  const { chainId, isDeployed, handshakeAddress, explorerBase } = useChain()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [refresh, setRefresh] = useState(0)

  const { data: job, refetch } = useReadContract({
    address: handshakeAddress as `0x${string}` | undefined,
    abi: HANDSHAKE_ABI,
    functionName: 'getJob',
    args: [jobId],
    chainId,
    query: { enabled: isDeployed && !!handshakeAddress },
  })

  const { events, loading: eventsLoading } = useJobEvents(jobId)
  const now = useNow()

  const j = job as JobTuple | undefined

  useEffect(() => {
    void buildShareLink(`/job/${jobId.toString()}`).then(setShareUrl)
  }, [jobId])

  const handleRefresh = () => {
    setRefresh((r) => r + 1)
    void refetch()
  }

  const copyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isDeployed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
          Handshake is not yet deployed on this chain. Switch to Arc Testnet to view jobs.
        </p>
      </div>
    )
  }

  if (!j) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-pulse text-sm" style={{ color: 'var(--muted)' }}>Loading job…</div>
      </div>
    )
  }

  const hasArbiter = j.arbiter !== '0x0000000000000000000000000000000000000000'

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
      {/* Hero */}
      <div
        className="rounded-3xl p-5"
        style={{
          background: 'var(--surface-strong)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="mono text-xs" style={{ color: 'var(--muted)' }}>Job #{jobId.toString()}</span>
            <StatusBadge status={j.status} />
          </div>
          <button
            onClick={() => { void copyLink() }}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
            style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
            title="Copy share link"
          >
            {copied ? <CheckCheck className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="display text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {formatUsdc(j.amount)}
          </span>
          <span className="text-lg font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
        </div>

        <p className="mt-2 text-sm" style={{ color: 'var(--ink-2)' }}>
          {j.description || '(no description)'}
        </p>

        {j.deliveryRef && (
          <a
            href={j.deliveryRef.startsWith('http') ? j.deliveryRef : undefined}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs"
            style={{ color: 'var(--accent-hover)' }}
          >
            <ExternalLink className="size-3" /> Delivery ref: {j.deliveryRef}
          </a>
        )}

        {/* Arbiter callout — prominent so seller sees it before delivering */}
        <div
          className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{
            background: hasArbiter ? 'rgba(18,45,69,0.06)' : 'rgba(139,132,156,0.08)',
            border: '1px solid var(--border)',
          }}
        >
          <span className="mt-0.5 shrink-0 font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Arbiter</span>
          {hasArbiter ? (
            <a
              href={`${explorerBase}/address/${j.arbiter}`}
              target="_blank"
              rel="noreferrer"
              className="mono break-all inline-flex items-center gap-1"
              style={{ color: 'var(--accent-hover)' }}
            >
              {j.arbiter} <ExternalLink className="size-3 shrink-0" />
            </a>
          ) : (
            <span style={{ color: 'var(--subtle)' }}>
              None — disputes require both parties to agree on a split, or expire 50/50 after the dispute window.
            </span>
          )}
        </div>
      </div>

      {/* Timers */}
      {j.status < 2 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Deadline</p>
            <p className="mt-1 text-sm font-medium tabular-nums" style={{ color: now >= j.deadline ? 'var(--danger)' : 'var(--ink)' }}>
              {formatDeadline(j.deadline)}
            </p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>{countdown(j.deadline)} remaining</p>
          </div>
          {j.deliveredAt > 0n && (
            <div className="rounded-2xl p-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Review window</p>
              <p className="mt-1 text-sm font-medium tabular-nums" style={{ color: 'var(--ink)' }}>
                {formatDeadline(j.deliveredAt + j.reviewWindow)}
              </p>
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>{countdown(j.deliveredAt + j.reviewWindow)} remaining</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <JobActions key={refresh} jobId={jobId} job={j} onRefresh={handleRefresh} />

      {/* Details */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Details</h3>
        <div
          className="rounded-2xl px-4"
          style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
        >
          <InfoRow label="Status" value={JOB_STATUS_LABELS[j.status]} />
          <InfoRow
            label="Buyer"
            value={
              <a href={`${explorerBase}/address/${j.buyer}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1" style={{ color: 'var(--accent-hover)' }}>
                {formatAddress(j.buyer)} <ExternalLink className="size-3" />
              </a>
            }
          />
          <InfoRow
            label="Seller"
            value={
              <a href={`${explorerBase}/address/${j.seller}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1" style={{ color: 'var(--accent-hover)' }}>
                {formatAddress(j.seller)} <ExternalLink className="size-3" />
              </a>
            }
          />
          {hasArbiter && (
            <InfoRow
              label="Arbiter"
              value={
                <a href={`${explorerBase}/address/${j.arbiter}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1" style={{ color: 'var(--accent-hover)' }}>
                  {formatAddress(j.arbiter)} <ExternalLink className="size-3" />
                </a>
              }
            />
          )}
          <InfoRow label="Deadline" value={formatDeadline(j.deadline)} />
          <InfoRow label="Review Window" value={`${Number(j.reviewWindow) / 3600}h`} />
          <InfoRow label="Dispute Window" value={`${Number(j.disputeWindow) / 3600}h`} />
          {j.deliveredAt > 0n && <InfoRow label="Delivered At" value={formatDeadline(j.deliveredAt)} />}
          {j.disputeDeadline > 0n && (
            <InfoRow
              label="Dispute Deadline"
              value={<span style={{ color: now >= j.disputeDeadline ? 'var(--danger)' : 'var(--ink-2)' }}>
                {formatDeadline(j.disputeDeadline)}
              </span>}
            />
          )}
        </div>
      </section>

      {/* Event timeline */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          On-chain History
        </h3>
        <EventTimeline events={events} loading={eventsLoading} />
      </section>
    </div>
  )
}
