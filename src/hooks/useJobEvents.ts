import { usePublicClient } from 'wagmi'
import { useEffect, useState } from 'react'
import { parseAbiItem, decodeEventLog, type Log } from 'viem'
import { HANDSHAKE_ABI } from '../contracts/handshake'
import { useChain } from './useChain'

export type JobEvent = {
  name: string
  blockNumber: bigint
  txHash: `0x${string}`
  args: Record<string, unknown>
}

const EVENT_NAMES = [
  'JobOpened',
  'JobDelivered',
  'JobReleased',
  'JobRefunded',
  'JobDisputed',
  'JobSettled',
  'SplitProposed',
  'FundsClaimable',
  'Claimed',
]

export function useJobEvents(jobId: bigint | undefined) {
  const { chainId, isDeployed, handshakeAddress } = useChain()
  const publicClient = usePublicClient({ chainId })
  const [events, setEvents] = useState<JobEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!publicClient || jobId === undefined || !isDeployed || !handshakeAddress) {
      return undefined
    }
    const contractAddress = handshakeAddress
    let cancelled = false

    const loadEvents = async () => {
      // oxlint-disable-next-line react/set-state-in-effect
      setLoading(true)
      try {
        const logs: Log[] = await publicClient.getLogs({
          address: contractAddress,
          fromBlock: 0n,
          toBlock: 'latest',
        })

        const parsed: JobEvent[] = []
        for (const log of logs) {
          try {
            const decoded = decodeEventLog({
              abi: HANDSHAKE_ABI,
              data: log.data,
              topics: log.topics,
            })
            const evName = decoded.eventName as string | undefined
            if (!evName || !EVENT_NAMES.includes(evName)) continue
            const rawArgs = decoded.args as unknown
            const args: Record<string, unknown> =
              rawArgs !== null && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
                ? (rawArgs as Record<string, unknown>)
                : {}
            const logJobId = args['jobId']
            if (logJobId !== undefined && logJobId !== jobId) continue
            parsed.push({
              name: evName,
              blockNumber: log.blockNumber ?? 0n,
              txHash: (log.transactionHash ?? '0x0'),
              args,
            })
          } catch {
            // skip undecodeable logs
          }
        }

        parsed.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : 1))

        if (!cancelled) {
          setEvents(parsed)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    void loadEvents()
    return () => {
      cancelled = true
    }
  }, [publicClient, jobId, isDeployed, handshakeAddress])

  return { events, loading }
}

export function useMyJobIds(address: `0x${string}` | undefined) {
  const { chainId, isDeployed, handshakeAddress } = useChain()
  const publicClient = usePublicClient({ chainId })
  const [asBuyer, setAsBuyer] = useState<bigint[]>([])
  const [asSeller, setAsSeller] = useState<bigint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!publicClient || !address || !isDeployed || !handshakeAddress) return undefined
    const contractAddress = handshakeAddress
    let cancelled = false

    const loadJobIds = async () => {
      // oxlint-disable-next-line react/set-state-in-effect
      setLoading(true)
      try {
        const logs = await publicClient.getLogs({
          address: contractAddress,
          event: parseAbiItem(
            'event JobOpened(uint256 indexed jobId, address indexed buyer, address indexed seller, address arbiter, uint256 amount, uint64 deadline, uint64 reviewWindow, uint64 disputeWindow, string description)'
          ),
          fromBlock: 0n,
          toBlock: 'latest',
        })

        const buyers: bigint[] = []
        const sellers: bigint[] = []

        for (const log of logs) {
          const args = log.args as { jobId?: bigint; buyer?: string; seller?: string }
          if (!args.jobId) continue
          if (args.buyer?.toLowerCase() === address.toLowerCase()) buyers.push(args.jobId)
          if (args.seller?.toLowerCase() === address.toLowerCase()) sellers.push(args.jobId)
        }

        if (!cancelled) {
          setAsBuyer(buyers.reverse())
          setAsSeller(sellers.reverse())
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    void loadJobIds()
    return () => {
      cancelled = true
    }
  }, [publicClient, address, isDeployed, handshakeAddress])

  return { asBuyer, asSeller, loading }
}
