import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '../contracts/handshake'

interface Props {
  status: number
}

export default function StatusBadge({ status }: Props) {
  const label = JOB_STATUS_LABELS[status] ?? 'Unknown'
  const color = JOB_STATUS_COLORS[status] ?? 'var(--muted)'
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {label}
    </span>
  )
}
