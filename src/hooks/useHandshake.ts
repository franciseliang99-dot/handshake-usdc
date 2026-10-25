import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { useAccount } from 'wagmi'
import { erc20Abi } from 'viem'
import { toast } from 'sonner'
import { HANDSHAKE_ABI } from '../contracts/handshake'
import { parseOnchainError } from '../lib/format'
import { getUsdc } from '../onchain-facts'
import { useChain } from './useChain'

function useAction(_label: string) {
  const { chainId } = useAccount()
  const { isArcChain, isDeployed, handshakeAddress, chainId: arcChainId } = useChain()
  const { writeContractAsync, isPending, data: hash } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // A write is only runnable when: connected to a supported Arc chain that has a deployed contract.
  const canRun = isArcChain && isDeployed && !!handshakeAddress && !!chainId

  const run = async (fn: (contractAddress: `0x${string}`, activeChainId: number) => Promise<void>) => {
    if (!canRun || !handshakeAddress || !arcChainId) {
      // Caller should guard before calling; this is a safety fallback
      return
    }
    try {
      await fn(handshakeAddress, arcChainId)
    } catch (e) {
      toast.error(parseOnchainError(e))
    }
  }

  return { run, isPending, isConfirming, isSuccess, canRun, writeContractAsync, activeChainId: arcChainId }
}

export function useOpenJob() {
  const { run, isPending, isConfirming, isSuccess, writeContractAsync, activeChainId } = useAction('Open job')
  const publicClient = usePublicClient({ chainId: activeChainId })

  const openJob = async (params: {
    seller: `0x${string}`
    arbiter: `0x${string}`
    amount: bigint
    description: string
    deadline: bigint
    reviewWindow: bigint
    disputeWindow: bigint
  }) => {
    await run(async (contractAddress, cid) => {
      const usdcFact = getUsdc(cid)
      if (!usdcFact) { toast.error('USDC not configured for this chain.'); return }
      const usdcAddress = usdcFact.address as `0x${string}`

      // 1. Approve USDC
      const approveTx = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [contractAddress, params.amount],
        chainId: cid,
      })
      await publicClient!.waitForTransactionReceipt({ hash: approveTx })

      // 2. Open job
      await writeContractAsync({
        address: contractAddress,
        abi: HANDSHAKE_ABI,
        functionName: 'openJob',
        args: [
          params.seller,
          params.arbiter,
          params.amount,
          params.description,
          params.deadline,
          params.reviewWindow,
          params.disputeWindow,
        ],
        chainId: cid,
      })
      toast.success('Job opened!')
    })
  }

  return { openJob, isPending, isConfirming, isSuccess }
}

export function useDeliver() {
  const { run, isPending, isConfirming, isSuccess, writeContractAsync } = useAction('Deliver')
  const deliver = async (jobId: bigint, deliveryRef: string) => {
    await run(async (contractAddress, cid) => {
      await writeContractAsync({
        address: contractAddress,
        abi: HANDSHAKE_ABI,
        functionName: 'deliver',
        args: [jobId, deliveryRef],
        chainId: cid,
      })
      toast.success('Delivery submitted!')
    })
  }
  return { deliver, isPending, isConfirming, isSuccess }
}

export function useRelease() {
  const { run, isPending, isConfirming, isSuccess, writeContractAsync } = useAction('Release')
  const release = async (jobId: bigint) => {
    await run(async (contractAddress, cid) => {
      await writeContractAsync({
        address: contractAddress,
        abi: HANDSHAKE_ABI,
        functionName: 'release',
        args: [jobId],
        chainId: cid,
      })
      toast.success('Payment released to seller!')
    })
  }
  return { release, isPending, isConfirming, isSuccess }
}

export function useDispute() {
  const { run, isPending, isConfirming, isSuccess, writeContractAsync } = useAction('Dispute')
  const dispute = async (jobId: bigint) => {
    await run(async (contractAddress, cid) => {
      await writeContractAsync({
        address: contractAddress,
        abi: HANDSHAKE_ABI,
        functionName: 'dispute',
        args: [jobId],
        chainId: cid,
      })
      toast.success('Dispute opened.')
    })
  }
  return { dispute, isPending, isConfirming, isSuccess }
}

export function useAutoRelease() {
  const { run, isPending, isConfirming, isSuccess, writeContractAsync } = useAction('Auto-release')
  const autoRelease = async (jobId: bigint) => {
    await run(async (contractAddress, cid) => {
      await writeContractAsync({
        address: contractAddress,
        abi: HANDSHAKE_ABI,
        functionName: 'autoRelease',
        args: [jobId],
        chainId: cid,
      })
      toast.success('Payment auto-released to seller!')
    })
  }
  return { autoRelease, isPending, isConfirming, isSuccess }
}

export function useRefund() {
  const { run, isPending, isConfirming, isSuccess, writeContractAsync } = useAction('Refund')
  const refund = async (jobId: bigint) => {
    await run(async (contractAddress, cid) => {
      await writeContractAsync({
        address: contractAddress,
        abi: HANDSHAKE_ABI,
        functionName: 'refund',
        args: [jobId],
        chainId: cid,
      })
      toast.success('Refund triggered!')
    })
  }
  return { refund, isPending, isConfirming, isSuccess }
}

export function useSettle() {
  const { run, isPending, isConfirming, isSuccess, writeContractAsync } = useAction('Settle')
  const settle = async (jobId: bigint, sellerShare: bigint) => {
    await run(async (contractAddress, cid) => {
      await writeContractAsync({
        address: contractAddress,
        abi: HANDSHAKE_ABI,
        functionName: 'settle',
        args: [jobId, sellerShare],
        chainId: cid,
      })
      toast.success('Job settled!')
    })
  }
  return { settle, isPending, isConfirming, isSuccess }
}

export function useAgreeToSplit() {
  const { run, isPending, isConfirming, isSuccess, writeContractAsync } = useAction('Agree to split')
  const agreeToSplit = async (jobId: bigint, sellerShare: bigint) => {
    await run(async (contractAddress, cid) => {
      await writeContractAsync({
        address: contractAddress,
        abi: HANDSHAKE_ABI,
        functionName: 'agreeToSplit',
        args: [jobId, sellerShare],
        chainId: cid,
      })
      toast.success('Split proposal submitted!')
    })
  }
  return { agreeToSplit, isPending, isConfirming, isSuccess }
}

export function useExpireDispute() {
  const { run, isPending, isConfirming, isSuccess, writeContractAsync } = useAction('Expire dispute')
  const expireDispute = async (jobId: bigint) => {
    await run(async (contractAddress, cid) => {
      await writeContractAsync({
        address: contractAddress,
        abi: HANDSHAKE_ABI,
        functionName: 'expireDispute',
        args: [jobId],
        chainId: cid,
      })
      toast.success('Dispute expired — funds split 50/50!')
    })
  }
  return { expireDispute, isPending, isConfirming, isSuccess }
}

export function useClaim() {
  const { run, isPending, isConfirming, isSuccess, writeContractAsync } = useAction('Claim')
  const claim = async () => {
    await run(async (contractAddress, cid) => {
      await writeContractAsync({
        address: contractAddress,
        abi: HANDSHAKE_ABI,
        functionName: 'claim',
        args: [],
        chainId: cid,
      })
      toast.success('USDC claimed!')
    })
  }
  return { claim, isPending, isConfirming, isSuccess }
}
