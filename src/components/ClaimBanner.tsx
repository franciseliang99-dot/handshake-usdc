import { useReadContract } from 'wagmi'
import { HANDSHAKE_ABI } from '../contracts/handshake'
import { formatUsdc } from '../lib/format'
import { useClaim } from '../hooks/useHandshake'
import { useChain } from '../hooks/useChain'
import { Loader2 } from 'lucide-react'

interface Props {
  address: `0x${string}`
}

export default function ClaimBanner({ address }: Props) {
  const { chainId, isDeployed, handshakeAddress } = useChain()
  const { data: claimableRaw, refetch } = useReadContract({
    address: handshakeAddress as `0x${string}` | undefined,
    abi: HANDSHAKE_ABI,
    functionName: 'claimable',
    args: [address],
    chainId,
    query: { enabled: isDeployed && !!handshakeAddress },
  })

  const { claim, isPending, isConfirming } = useClaim()
  const claimable = claimableRaw as bigint | undefined

  if (!claimable || claimable === 0n) return null

  const handleClaim = () => {
    void claim().then(() => void refetch())
  }

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
      style={{ background: 'rgba(26,128,71,0.08)', border: '1px solid rgba(26,128,71,0.20)' }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
          {formatUsdc(claimable)} USDC claimable
        </p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Settled funds ready to withdraw.</p>
      </div>
      <button
        disabled={isPending || isConfirming}
        onClick={() => handleClaim()}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        style={{ background: 'var(--success)' }}
      >
        {(isPending || isConfirming) && <Loader2 className="size-3 animate-spin" />}
        Claim
      </button>
    </div>
  )
}
