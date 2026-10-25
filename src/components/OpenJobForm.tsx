import { useState } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { parseUsdc } from '../lib/format'
import { useOpenJob } from '../hooks/useHandshake'
import TxButton from './TxButton'
import { toast } from 'sonner'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

const glass = {
  inner: {
    background: 'rgba(255,255,255,0.60)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid var(--border)',
    borderRadius: '1rem',
    padding: '1rem',
  },
}

function hoursFromNow(h: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + h * 3600)
}

export default function OpenJobForm({ onClose, onSuccess }: Props) {
  const { address } = useAccount()
  const [seller, setSeller] = useState('')
  const [arbiter, setArbiter] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [deadlineHours, setDeadlineHours] = useState('48')
  const [reviewWindowHours, setReviewWindowHours] = useState('24')
  const [disputeWindowHours, setDisputeWindowHours] = useState('48')

  const { openJob, isPending, isConfirming, isSuccess } = useOpenJob()

  const handleSubmit = async () => {
    if (!address) { toast.error('Connect your wallet first.'); return }
    if (!seller.match(/^0x[0-9a-fA-F]{40}$/)) { toast.error('Invalid seller address.'); return }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { toast.error('Enter a valid USDC amount.'); return }
    if (!description.trim()) { toast.error('Add a job description.'); return }

    const arbiterAddr: `0x${string}` = arbiter.match(/^0x[0-9a-fA-F]{40}$/)
      ? (arbiter as `0x${string}`)
      : '0x0000000000000000000000000000000000000000'

    try {
      await openJob({
        seller: seller as `0x${string}`,
        arbiter: arbiterAddr,
        amount: parseUsdc(amount),
        description: description.trim(),
        deadline: hoursFromNow(Number(deadlineHours) || 48),
        reviewWindow: BigInt((Number(reviewWindowHours) || 24) * 3600),
        disputeWindow: BigInt((Number(disputeWindowHours) || 48) * 3600),
      })
      onSuccess()
    } catch {
      // errors handled by hook
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
        <motion.section
          className="relative w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(40px) saturate(200%)',
            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* spectral strip */}
          <div className="h-1" style={{ background: 'linear-gradient(90deg,#4f8ef7,#a78bfa,#f472b6,#fb923c)' }} />

          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="display text-lg font-semibold" style={{ color: 'var(--ink)' }}>Open a Job</h2>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full"
              style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-3 px-5 pb-6 overflow-y-auto max-h-[80dvh]">
            <div style={glass.inner}>
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Seller Address *
              </label>
              <input
                className="mt-1 w-full bg-transparent text-sm outline-none mono"
                style={{ color: 'var(--ink)' }}
                placeholder="0x..."
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
              />
            </div>

            <div style={glass.inner}>
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                USDC Amount *
              </label>
              <div className="mt-1 flex items-baseline gap-2">
                <input
                  inputMode="decimal"
                  className="display w-full bg-transparent text-3xl font-bold tabular-nums outline-none"
                  style={{ color: 'var(--ink)' }}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '')
                    if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
                  }}
                />
                <span className="text-lg font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
              </div>
            </div>

            <div style={glass.inner}>
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Description *
              </label>
              <textarea
                rows={3}
                className="mt-1 w-full resize-none bg-transparent text-sm outline-none"
                style={{ color: 'var(--ink)' }}
                placeholder="What should be delivered?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Deadline (h)', val: deadlineHours, set: setDeadlineHours, hint: 'max 8760h' },
                { label: 'Review (h)', val: reviewWindowHours, set: setReviewWindowHours, hint: 'max 720h' },
                { label: 'Dispute (h)', val: disputeWindowHours, set: setDisputeWindowHours, hint: 'max 720h' },
              ].map(({ label, val, set, hint }) => (
                <div key={label} style={glass.inner}>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    {label}
                  </label>
                  <input
                    inputMode="numeric"
                    className="mt-1 w-full bg-transparent text-sm tabular-nums outline-none"
                    style={{ color: 'var(--ink)' }}
                    value={val}
                    onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
                  />
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>{hint}</p>
                </div>
              ))}
            </div>

            <div style={glass.inner}>
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Arbiter Address (optional)
              </label>
              <input
                className="mt-1 w-full bg-transparent text-sm outline-none mono"
                style={{ color: 'var(--ink)' }}
                placeholder="Leave blank for mutual-agreement disputes"
                value={arbiter}
                onChange={(e) => setArbiter(e.target.value)}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
                Must be a neutral address — cannot be the buyer or seller.
                Disputes expire 50/50 after the dispute window if unresolved.
              </p>
            </div>

            <TxButton
              label="Approve USDC & Open Job"
              onClick={() => { void handleSubmit() }}
              isPending={isPending}
              isConfirming={isConfirming}
              disabled={isSuccess}
              className="w-full"
            />

            <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
              Two transactions: first approve USDC, then open job.
            </p>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  )
}
