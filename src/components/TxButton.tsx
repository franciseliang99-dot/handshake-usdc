import { Loader2 } from 'lucide-react'

interface Props {
  label: string
  onClick: () => void
  disabled?: boolean
  isPending?: boolean
  isConfirming?: boolean
  variant?: 'primary' | 'ghost' | 'danger'
  className?: string
}

export default function TxButton({
  label,
  onClick,
  disabled,
  isPending,
  isConfirming,
  variant = 'primary',
  className = '',
}: Props) {
  const busy = isPending || isConfirming
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40'

  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff' },
    ghost: {
      background: 'var(--surface-muted)',
      color: 'var(--ink)',
      border: '1px solid var(--border)',
    },
    danger: { background: 'var(--danger)', color: '#fff' },
  }

  return (
    <button
      className={`${base} ${className}`}
      style={styles[variant]}
      onClick={onClick}
      disabled={disabled || busy}
    >
      {busy && <Loader2 className="size-3.5 animate-spin" />}
      {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : label}
    </button>
  )
}
