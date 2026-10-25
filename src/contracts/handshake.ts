import artifact from '../../contracts/out/Handshake.sol/Handshake.json'

export const HANDSHAKE_ABI = artifact.abi

// ─── Per-chain contract addresses ────────────────────────────────────────────
// Arc Testnet (5042002): deployed and active.
// Arc Mainnet (5042): NOT YET DEPLOYED — fill in after you deploy with your own
// wallet. Leave as empty string to keep the "not deployed" UI state.
const HANDSHAKE_ADDRESSES: Record<number, `0x${string}` | ''> = {
  5042002: '0xbedd6d939872a8e91b1f46179d0ccfe235d9a43c', // Arc Testnet
  5042:    '',                                             // Arc Mainnet — fill in after deploy
}

/** Returns the contract address for a chain, or '' if not yet deployed. */
export function getHandshakeAddress(chainId: number): `0x${string}` | '' {
  return HANDSHAKE_ADDRESSES[chainId] ?? ''
}

/** True when Handshake is deployed on this chain and the address is set. */
export function isHandshakeDeployed(chainId: number): boolean {
  const addr = HANDSHAKE_ADDRESSES[chainId]
  return typeof addr === 'string' && addr.length > 0
}

// ─── Supported Arc chain IDs ──────────────────────────────────────────────────
export const ARC_MAINNET_CHAIN_ID = 5042
export const ARC_TESTNET_CHAIN_ID = 5042002
export const SUPPORTED_CHAIN_IDS = [ARC_TESTNET_CHAIN_ID, ARC_MAINNET_CHAIN_ID] as const

export const JOB_STATUS_LABELS: Record<number, string> = {
  0: 'Open',
  1: 'Delivered',
  2: 'Released',
  3: 'Refunded',
  4: 'Disputed',
}

export const JOB_STATUS_COLORS: Record<number, string> = {
  0: 'var(--accent)',
  1: 'var(--warning)',
  2: 'var(--success)',
  3: 'var(--muted)',
  4: 'var(--danger)',
}

export type JobTuple = {
  buyer: `0x${string}`
  seller: `0x${string}`
  arbiter: `0x${string}`
  amount: bigint
  deadline: bigint
  reviewWindow: bigint
  disputeWindow: bigint
  deliveredAt: bigint
  disputeDeadline: bigint
  description: string
  deliveryRef: string
  status: number
}
