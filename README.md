# Handshake

Pay-on-delivery USDC escrow for one software agent (or service) hiring another. A buyer opens a job with a USDC deposit; the seller delivers before the deadline; the buyer releases, disputes, or does nothing (triggering auto-release). All payouts use a pull-payment model — settled funds accumulate in a claimable balance and are withdrawn with one call.

Built with [Arc Studio](https://studio.arc.io)

## Tech Stack

- **Smart contract**: Solidity 0.8.28, OpenZeppelin SafeERC20
- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS — builds as a static site
- **Onchain**: wagmi v2, viem, ConnectKit — supports Arc Testnet and Arc Mainnet

## Networks and Contract Addresses

| Network      | Chain ID | Contract Address                             | Explorer |
|--------------|----------|----------------------------------------------|---------|
| Arc Testnet  | 5042002  | `0xbedd6d939872a8e91b1f46179d0ccfe235d9a43c` | [explorer.testnet.arc.io](https://explorer.testnet.arc.io/address/0xbedd6d939872a8e91b1f46179d0ccfe235d9a43c) |
| Arc Mainnet  | 5042     | *(not yet deployed — fill in `src/contracts/handshake.ts` after you deploy)* | [explorer.arc.io](https://explorer.arc.io) |

USDC address (both networks): `0x3600000000000000000000000000000000000000`

To deploy to Arc Mainnet yourself, run `forge create` with your own wallet and pass the USDC address as the constructor argument. Then open `src/contracts/handshake.ts` and set the `5042` entry in `HANDSHAKE_ADDRESSES` to your deployed address.

## Features

- Connect wallet (injected browser wallet — MetaMask, Rabby, etc.) and open a job
- Network badge in the header shows the active chain and contract address, linked to the right explorer
- Switch-to-Arc prompt when the wallet is on a wrong or unsupported chain
- "Not deployed" message when connected to Arc Mainnet before the contract address is set
- Job board: view all jobs you opened as buyer or accepted as seller, with live status and timers
- Job detail page (shareable by job ID): full on-chain event history, all available action buttons
- Actions: deliver, release, dispute, auto-release, refund, arbiter settle, mutual-split agree, expire dispute
- Pull-payment claim banner: shows and claims your claimable USDC balance
- Lookup any job by ID

## Job State Machine

```
OPEN → DELIVERED → RELEASED         (buyer releases, or auto-release after review window)
OPEN → DELIVERED → DISPUTED → RELEASED  (arbiter settles, or both parties agree on split, or dispute expires)
OPEN → REFUNDED                     (seller misses deadline — permissionless trigger)
```

## Dispute Rules

**Who can do what:**

- **Buyer** can call `release()` or `dispute()` at any time during the review window (the period after the seller marks delivery). Both actions are blocked once the review window has elapsed.
- After the review window, **anyone** can call `autoRelease()` to release funds to the seller (protecting a seller from a silent buyer). `release` by the buyer is no longer available at that point.
- **Seller** cannot be the first to open a dispute; they can only propose a split once a dispute is open.
- **Arbiter** (if one was named when the job was opened) can call `settle(jobId, sellerShare)` to split the funds in any proportion they choose. The arbiter must be a neutral address — it cannot be the buyer or seller.
- **Both buyer and seller** (with no arbiter) can each call `agreeToSplit(jobId, sellerShare)`. When both propose the same seller share, the split executes immediately.
- **Anyone** can call `expireDispute(jobId)` once the dispute window elapses without resolution. The funds are split 50/50: the seller receives `amount - amount/2`, and the buyer receives `amount/2` — so if the amount has an odd smallest unit, the seller gets it.
- Once the dispute window has elapsed, `settle` and `agreeToSplit` both revert. Only `expireDispute` can resolve an expired dispute, enforcing the 50/50 default.

A buyer who disputes every delivery and waits out the window loses half the payment, not all of it — disputes have a real cost for the buyer.

**Limits (enforced on-chain):**

| Parameter | Minimum | Maximum |
|---|---|---|
| Review window | 1 second | 30 days |
| Dispute window | 1 second | 30 days |
| Deadline | 1 second from now | 365 days from now |

These caps prevent integer overflow in deadline arithmetic and protect both parties from indefinitely frozen funds.

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.x
- [Foundry](https://getfoundry.sh) (for contract work)

### Install

```bash
bun install
```

### Environment Variables

None required for the frontend (Arc Testnet RPC is public). The following are provisioned automatically inside Arc Studio:

| Variable | Purpose | Required outside Arc Studio? |
|---|---|---|
| `RPC_PROXY_BASE_URL` | Arc Studio RPC proxy base URL | Optional (falls back to public RPC) |
| `RPC_PROXY_TOKEN` | Arc Studio RPC proxy auth token | Optional |
| `RPC_PROXY_CHAINS` | Comma-separated supported chain keys | Optional |

### Run

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Test contracts

```bash
bun run contracts:test
```

### Check (lint + typecheck)

```bash
bun run check
```

## Building and Hosting the Static Site

The production build outputs to `dist/` as a fully static site with relative asset paths (`base: './'` in `vite.config.ts`). It works at any sub-path — for example `https://example.github.io/handshake/` — because all routing uses URL hash fragments (`#/job/1`), not the server path.

```bash
bun run build     # outputs to dist/
```

The injected browser wallet (MetaMask, Rabby, etc.) works on any HTTPS origin — it connects directly from the browser to the Arc RPC. There is no server component and no API keys are required.

### GitHub Pages (automatic)

`.github/workflows/pages.yml` builds and deploys the app to GitHub Pages on every push to `main`. The workflow:

1. Installs Foundry and Bun from scratch (no pre-built artifacts needed).
2. Runs `forge build` to generate `contracts/out/` (excluded from git by `.gitignore`).
3. Runs `forge test` — all 63 contract tests must pass before a deploy proceeds.
4. Runs `bun run build` to produce `dist/`.
5. Uploads `dist/` and deploys via `actions/deploy-pages`.

To enable it in your repo: go to **Settings → Pages**, set source to **GitHub Actions**, and push to `main`. No secrets or environment variables are required.

### Other hosts

- **Netlify / Vercel**: connect the repo and set build command `bun run build`, output directory `dist`. Add a build step `forge build` before `bun run build` if the platform supports custom build commands.
- **Any static host**: run the build locally and upload `dist/`.

## Deploying the Contract to Arc Mainnet

The same contract source works on Arc Mainnet. Deploy with your own wallet:

```bash
forge create contracts/Handshake.sol:Handshake \
  --rpc-url https://rpc.mainnet.arc.io \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args 0x3600000000000000000000000000000000000000
```

Then open `src/contracts/handshake.ts` and set the `5042` entry in `HANDSHAKE_ADDRESSES` to your deployed address. Rebuild and redeploy the frontend.
