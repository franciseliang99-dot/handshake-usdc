/**
 * useChain — single source of truth for the active Arc chain.
 *
 * Returns everything a component needs to know about the connected chain:
 *   - isArcChain: wallet is on one of the two supported Arc chains
 *   - isDeployed: Handshake contract is deployed on the active chain
 *   - chainId: the active chain ID (or undefined if not connected)
 *   - chainName: human-readable name ("Arc Testnet" / "Arc" / other)
 *   - handshakeAddress: the contract address on this chain (or '' if not deployed)
 *   - explorerBase: the right block explorer for this chain
 *   - switchToTestnet / switchToMainnet: helpers that prompt a chain switch
 */

import { useAccount, useSwitchChain } from 'wagmi'
import {
  SUPPORTED_CHAIN_IDS,
  ARC_TESTNET_CHAIN_ID,
  ARC_MAINNET_CHAIN_ID,
  getHandshakeAddress,
  isHandshakeDeployed,
} from '../contracts/handshake'
import { requireChain } from '../onchain-facts'

const testnetFact = requireChain(ARC_TESTNET_CHAIN_ID)
const mainnetFact = requireChain(ARC_MAINNET_CHAIN_ID)

export function useChain() {
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const isArcChain = chainId !== undefined && (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId)

  const chainFact = isArcChain
    ? requireChain(chainId)
    : undefined

  const handshakeAddress = isArcChain ? getHandshakeAddress(chainId) : ''
  const deployed = isArcChain ? isHandshakeDeployed(chainId) : false

  const explorerBase = chainFact?.explorerBase ?? testnetFact.explorerBase

  const chainName = chainFact?.name ?? (chainId !== undefined ? `Chain ${chainId}` : 'Unknown')

  return {
    chainId,
    chainName,
    isArcChain,
    isDeployed: deployed,
    handshakeAddress: handshakeAddress,
    explorerBase,
    // For the "not on the right chain" switch buttons
    testnetName: testnetFact.name,
    mainnetName: mainnetFact.name,
    switchToTestnet: () => switchChain({ chainId: ARC_TESTNET_CHAIN_ID }),
    switchToMainnet: () => switchChain({ chainId: ARC_MAINNET_CHAIN_ID }),
  }
}
