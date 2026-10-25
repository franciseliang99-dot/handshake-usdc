import { useState } from 'react'
import { useAccount } from 'wagmi'
import { JobTuple } from '../contracts/handshake'
import { formatUsdc, parseUsdc } from '../lib/format'
import TxButton from './TxButton'
import {
  useRelease, useDispute, useAutoRelease, useRefund,
  useSettle, useAgreeToSplit, useExpireDispute, useDeliver, useClaim
} from '../hooks/useHandshake'
import { useReadContract } from 'wagmi'
import { HANDSHAKE_ABI } from '../contracts/handshake'
import { useChain } from '../hooks/useChain'
import { useNow } from '../hooks/useNow'

interface Props {
  jobId: bigint
  job: JobTuple
  onRefresh: () => void
}

export default function JobActions({ jobId, job, onRefresh }: Props) {
  const { address } = useAccount()
  const { chainId, isDeployed, handshakeAddress } = useChain()
  const now = useNow()
  const isBuyer = address?.toLowerCase() === job.buyer.toLowerCase()
  const isSeller = address?.toLowerCase() === job.seller.toLowerCase()
  const isArbiter = job.arbiter !== '0x0000000000000000000000000000000000000000'
    && address?.toLowerCase() === job.arbiter.toLowerCase()

  const [deliveryRef, setDeliveryRef] = useState('')
  const [settleShare, setSettleShare] = useState('')
  const [splitShare, setSplitShare] = useState('')

  const { release, isPending: rP, isConfirming: rC } = useRelease()
  const { dispute, isPending: dP, isConfirming: dC } = useDispute()
  const { autoRelease, isPending: arP, isConfirming: arC } = useAutoRelease()
  const { refund, isPending: rfP, isConfirming: rfC } = useRefund()
  const { settle, isPending: sP, isConfirming: sC } = useSettle()
  const { agreeToSplit, isPending: aP, isConfirming: aC } = useAgreeToSplit()
  const { expireDispute, isPending: eP, isConfirming: eC } = useExpireDispute()
  const { deliver, isPending: dlP, isConfirming: dlC } = useDeliver()
  const { claim, isPending: clP, isConfirming: clC } = useClaim()

  const { data: claimableRaw } = useReadContract({
    address: handshakeAddress as `0x${string}` | undefined,
    abi: HANDSHAKE_ABI,
    functionName: 'claimable',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId,
    query: { enabled: !!address && isDeployed && !!handshakeAddress },
  })
  const claimable = claimableRaw as bigint | undefined

  const after = (fn: () => Promise<void>) => () => { void fn().then(onRefresh) }

  const s = job.status

  const reviewElapsed = job.deliveredAt > 0n && now >= job.deliveredAt + job.reviewWindow
  const reviewActive = job.deliveredAt > 0n && now < job.deliveredAt + job.reviewWindow
  const deadlinePassed = now >= job.deadline
  const disputeExpired = job.disputeDeadline > 0n && now >= job.disputeDeadline

  const actions: React.ReactNode[] = []

  // Seller: deliver
  if (s === 0 && isSeller && !deadlinePassed) {
    actions.push(
      <div key="deliver" className="space-y-2">
        <input
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'var(--surface-muted)' }}
          placeholder="Delivery reference (URL or content hash)"
          value={deliveryRef}
          onChange={(e) => setDeliveryRef(e.target.value)}
        />
        <TxButton
          label="Mark Delivered"
          isPending={dlP}
          isConfirming={dlC}
          onClick={after(() => deliver(jobId, deliveryRef))}
          disabled={!deliveryRef.trim()}
          className="w-full"
        />
      </div>
    )
  }

  // Anyone: refund if deadline passed and status OPEN
  if (s === 0 && deadlinePassed) {
    actions.push(
      <TxButton key="refund" label="Trigger Refund (deadline passed)" variant="ghost"
        isPending={rfP} isConfirming={rfC} onClick={after(() => refund(jobId))} className="w-full" />
    )
  }

  // Buyer: release or dispute during review window
  if (s === 1 && isBuyer && reviewActive) {
    actions.push(
      <TxButton key="release" label="Release Payment" isPending={rP} isConfirming={rC}
        onClick={after(() => release(jobId))} className="w-full" />
    )
    actions.push(
      <TxButton key="dispute" label="Open Dispute" variant="danger" isPending={dP} isConfirming={dC}
        onClick={after(() => dispute(jobId))} className="w-full" />
    )
  }

  // Anyone: auto-release if review window elapsed
  if (s === 1 && reviewElapsed) {
    actions.push(
      <TxButton key="autorelease" label="Auto-Release to Seller (review window elapsed)" variant="ghost"
        isPending={arP} isConfirming={arC} onClick={after(() => autoRelease(jobId))} className="w-full" />
    )
  }

  // DISPUTED — arbiter path
  if (s === 4 && isArbiter) {
    actions.push(
      <div key="settle" className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Arbiter: set seller's share (max {formatUsdc(job.amount)} USDC)
        </p>
        <input
          inputMode="decimal"
          className="w-full rounded-xl border px-3 py-2 text-sm tabular-nums outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'var(--surface-muted)' }}
          placeholder="USDC to seller"
          value={settleShare}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, '')
            if (v === '' || /^\d*\.?\d*$/.test(v)) setSettleShare(v)
          }}
        />
        <TxButton label="Settle" isPending={sP} isConfirming={sC}
          onClick={after(() => settle(jobId, settleShare ? parseUsdc(settleShare) : 0n))}
          disabled={!settleShare} className="w-full" />
      </div>
    )
  }

  // DISPUTED — no-arbiter mutual split
  if (s === 4 && !isArbiter && (isBuyer || isSeller) && job.arbiter === '0x0000000000000000000000000000000000000000') {
    actions.push(
      <div key="split" className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Propose seller's share (both parties must agree)
        </p>
        <input
          inputMode="decimal"
          className="w-full rounded-xl border px-3 py-2 text-sm tabular-nums outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'var(--surface-muted)' }}
          placeholder="USDC to seller"
          value={splitShare}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, '')
            if (v === '' || /^\d*\.?\d*$/.test(v)) setSplitShare(v)
          }}
        />
        <TxButton label="Propose Split" isPending={aP} isConfirming={aC}
          onClick={after(() => agreeToSplit(jobId, splitShare ? parseUsdc(splitShare) : 0n))}
          disabled={!splitShare} className="w-full" />
      </div>
    )
  }

  // Anyone: expire dispute if deadline passed
  if (s === 4 && disputeExpired) {
    actions.push(
      <TxButton key="expire" label="Expire Dispute (buyer refunded)" variant="ghost"
        isPending={eP} isConfirming={eC} onClick={after(() => expireDispute(jobId))} className="w-full" />
    )
  }

  // Claim claimable balance
  if (address && claimable && claimable > 0n) {
    actions.push(
      <div key="claim" className="rounded-2xl p-4" style={{ background: 'rgba(26,128,71,0.08)', border: '1px solid rgba(26,128,71,0.2)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
          {formatUsdc(claimable)} USDC claimable
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
          Funds ready to withdraw to your wallet.
        </p>
        <TxButton label="Claim USDC" isPending={clP} isConfirming={clC}
          onClick={after(claim)} className="mt-2 w-full" />
      </div>
    )
  }

  if (actions.length === 0) return null

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
        Actions
      </h3>
      {actions}
    </section>
  )
}
