/**
 * ChainGuard — shows a banner when the connected wallet is on a chain where
 * Handshake either isn't supported or hasn't been deployed yet.
 *
 * Returns null when everything is fine (on a supported Arc chain with a
 * deployed contract), so it composes cleanly — just mount it and forget it.
 */
import { useChain } from '../hooks/useChain'

export default function ChainGuard() {
  const {
    isArcChain,
    isDeployed,
    chainName,
    testnetName,
    mainnetName,
    switchToTestnet,
    switchToMainnet,
  } = useChain()

  // Everything is fine
  if (isArcChain && isDeployed) return null

  const isWrongChain = !isArcChain
  const isNotDeployed = isArcChain && !isDeployed

  return (
    <div
      className="rounded-2xl px-4 py-3 flex flex-col gap-2"
      style={{
        background: isWrongChain ? 'rgba(239,68,68,0.06)' : 'rgba(234,179,8,0.08)',
        border: `1px solid ${isWrongChain ? 'rgba(239,68,68,0.20)' : 'rgba(234,179,8,0.25)'}`,
      }}
    >
      <p className="text-sm font-semibold" style={{ color: isWrongChain ? 'var(--danger)' : 'var(--warning)' }}>
        {isWrongChain
          ? `Wallet connected to ${chainName} — Handshake runs on Arc.`
          : `Handshake is not yet deployed on ${chainName}.`}
      </p>
      {isNotDeployed && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          The contract address for {chainName} hasn't been filled in yet. Switch to testnet to try the app, or check back once the mainnet contract is deployed.
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={switchToTestnet}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Switch to {testnetName}
        </button>
        <button
          onClick={switchToMainnet}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
        >
          Switch to {mainnetName}
        </button>
      </div>
    </div>
  )
}
