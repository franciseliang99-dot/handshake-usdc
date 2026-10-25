import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { ExternalLink } from 'lucide-react'
import { useChain } from '../hooks/useChain'
import { formatAddress } from '../lib/format'

interface HeaderProps {
  view: 'board' | 'job'
  onBack?: () => void
}

export default function Header({ view, onBack }: HeaderProps) {
  const { isConnected } = useAccount()
  const { chainName, isArcChain, isDeployed, handshakeAddress, explorerBase } = useChain()

  // Network pill: shown when connected
  const networkDot = isArcChain
    ? (isDeployed ? 'var(--success)' : 'var(--warning)')
    : 'var(--danger)'

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 gap-3"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left: back + logo */}
      <div className="flex items-center gap-3 min-w-0">
        {view === 'job' && onBack && (
          <button
            onClick={onBack}
            className="flex size-8 items-center justify-center rounded-full text-sm transition-colors shrink-0"
            style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
            aria-label="Back"
          >
            ←
          </button>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex size-7 items-center justify-center rounded-lg text-xs font-bold text-white shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            H
          </div>
          <span className="display text-base font-semibold" style={{ color: 'var(--ink)' }}>
            Handshake
          </span>
        </div>
      </div>

      {/* Centre: network + contract info */}
      {isConnected && (
        <div className="hidden sm:flex flex-col items-center min-w-0">
          {/* Network name with status dot */}
          <div className="flex items-center gap-1.5">
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ background: networkDot }}
            />
            <span className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
              {chainName}
            </span>
          </div>
          {/* Contract address — shown when deployed */}
          {isArcChain && isDeployed && handshakeAddress && (
            <a
              href={`${explorerBase}/address/${handshakeAddress}`}
              target="_blank"
              rel="noreferrer"
              className="mono flex items-center gap-0.5 text-[10px] transition-opacity hover:opacity-70"
              style={{ color: 'var(--subtle)' }}
              title={handshakeAddress}
            >
              {formatAddress(handshakeAddress)}
              <ExternalLink className="size-2.5" />
            </a>
          )}
          {/* Not deployed on this chain */}
          {isArcChain && !isDeployed && (
            <span className="text-[10px]" style={{ color: 'var(--warning)' }}>
              Not deployed on {chainName}
            </span>
          )}
          {/* Wrong chain */}
          {!isArcChain && (
            <span className="text-[10px]" style={{ color: 'var(--danger)' }}>
              Switch to Arc
            </span>
          )}
        </div>
      )}

      {/* Right: wallet */}
      <ConnectKitButton />
    </header>
  )
}
