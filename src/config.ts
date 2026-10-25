/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { defineChain } from 'viem'
import { registerChain } from './tracing'
import { requireChain } from './onchain-facts'

// Arc Mainnet — defined from the onchain-facts registry so RPC / explorer are
// always in sync with the rest of the app.
const arcFact = requireChain(5042)
export const arcMainnet = defineChain({
  id: arcFact.chainId,
  name: arcFact.name,
  nativeCurrency: { name: 'USD Coin', symbol: arcFact.nativeCurrency.symbol, decimals: arcFact.nativeCurrency.decimals },
  rpcUrls: { default: { http: arcFact.rpcUrls as [string, ...string[]] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: arcFact.explorerBase } },
})

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arcMainnet.id, arcFact.rpcUrls[0])

export const config = createConfig({
  chains: [arcTestnet, arcMainnet, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(),
    [arcMainnet.id]: http(arcFact.rpcUrls[0]),
    [mainnet.id]: http(), // ENS resolution
  },
})
