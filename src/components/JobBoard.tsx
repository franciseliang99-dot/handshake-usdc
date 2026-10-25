import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Plus, Search } from 'lucide-react'
import { useMyJobIds } from '../hooks/useJobEvents'
import { useChain } from '../hooks/useChain'
import JobCard from './JobCard'
import OpenJobForm from './OpenJobForm'
import ClaimBanner from './ClaimBanner'
import ChainGuard from './ChainGuard'

interface Props {
  onSelectJob: (id: bigint) => void
}

type Tab = 'buyer' | 'seller' | 'lookup'

export default function JobBoard({ onSelectJob }: Props) {
  const { address, isConnected } = useAccount()
  const { isArcChain, isDeployed } = useChain()
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState<Tab>('buyer')
  const [lookupId, setLookupId] = useState('')
  const [refresh, setRefresh] = useState(0)

  const { asBuyer, asSeller, loading } = useMyJobIds(isConnected ? address : undefined)



  const handleLookup = () => {
    const id = BigInt(lookupId)
    if (id > 0n) onSelectJob(id)
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-5">
      {/* Chain guard — shown when wallet is connected but on wrong chain or undeployed chain */}
      {isConnected && <ChainGuard />}

      {/* Claim banner */}
      {isConnected && address && isArcChain && isDeployed && <ClaimBanner address={address} key={refresh} />}

      {/* Hero */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Jobs</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Pay-on-delivery USDC escrow</p>
        </div>
        {isConnected && isArcChain && isDeployed && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'var(--accent)' }}
          >
            <Plus className="size-4" /> New Job
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
        {(['buyer', 'seller', 'lookup'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-xl py-2 text-xs font-semibold transition-all capitalize"
            style={
              tab === t
                ? { background: '#fff', color: 'var(--ink)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: 'var(--muted)' }
            }
          >
            {t === 'lookup' ? 'By ID' : `As ${t}`}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'lookup' && (
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            className="flex-1 rounded-2xl border px-4 py-2.5 text-sm outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'var(--surface-strong)' }}
            placeholder="Job ID"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
          <button
            onClick={handleLookup}
            disabled={!lookupId}
            className="flex size-11 items-center justify-center rounded-2xl text-white disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            <Search className="size-4" />
          </button>
        </div>
      )}

      {tab !== 'lookup' && !isConnected && (
        <div className="rounded-2xl p-5 text-center" style={{ background: 'var(--surface-muted)' }}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to see your jobs.</p>
        </div>
      )}

      {tab === 'buyer' && isConnected && (
        <div className="space-y-2">
          {loading && Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl" style={{ background: 'var(--surface-muted)' }} />
          ))}
          {!loading && asBuyer.length === 0 && (
            <p className="py-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
              No jobs opened as buyer yet.
            </p>
          )}
          {asBuyer.map((id) => (
            <JobCard key={id.toString()} jobId={id} role="buyer" onClick={() => onSelectJob(id)} />
          ))}
        </div>
      )}

      {tab === 'seller' && isConnected && (
        <div className="space-y-2">
          {loading && Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl" style={{ background: 'var(--surface-muted)' }} />
          ))}
          {!loading && asSeller.length === 0 && (
            <p className="py-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
              No jobs assigned as seller yet.
            </p>
          )}
          {asSeller.map((id) => (
            <JobCard key={id.toString()} jobId={id} role="seller" onClick={() => onSelectJob(id)} />
          ))}
        </div>
      )}

      {showForm && (
        <OpenJobForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            setRefresh((r) => r + 1)
            setTab('buyer')
          }}
        />
      )}
    </div>
  )
}
