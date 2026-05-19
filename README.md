# Obscura — The Shadow Layer for Agentic Economy on Arc

> **Submission for the Stablecoin Commerce Stack Challenge — Track 4: Best Agentic Economy Experience on Arc**
>
> Obscura is **The Shadow Layer**: privacy infrastructure for the agentic economy on Arc Testnet. Autonomous agents discover, negotiate, and settle stablecoin trades behind opaque commitments — Pyth-priced AMMs, EIP-712 signed RFQ from a maker pool, sub-cent USDC nanopayments, programmable opacity vaults, x402 pay-per-call APIs, and multi-agent orchestration that bills each sub-agent for its own work.

[Architecture diagram + sequence diagrams →](./ARCHITECTURE.md)
[Step-by-step instructions for the agent operator →](./lanjut.md)

---

## What Obscura does (one minute pitch)

A user types `swap 5 USDC to GOLD if GOLD drops 1%`. The agent:

1. **Parses** the natural-language intent (Jatevo LLM or local regex)
2. **Watches** the Pyth GOLD oracle every 30s
3. When the condition triggers, **fans out** to 3 synthetic RFQ makers (Wintermute / Jump / Citadel personas)
4. **Charges itself** ~$0.0035 USDC across the maker pool via `ObscuraNanopay` channels — no on-chain tx per micro-event
5. **Verifies** every quote against Pyth ±2% to defend against compromised maker keys
6. **Settles** the best quote on-chain via `ObscuraRFQ.settle()` — atomic, one user click

USDC is the gas token, the quote token, the settlement asset, and the billing currency. Nothing is bridged. Sub-second finality on Arc.

---

## Why Track 4 (Agentic Economy)?

The challenge spec asks for *"autonomous economic experiences where AI agents can research, negotiate, and execute transactions on behalf of users or businesses using onchain rails and programmable payment logic."* Obscura ticks every box:

| Spec example | How Obscura implements it |
|---|---|
| AI agent autonomously discovers and executes a stablecoin-settled purchase | Conditional intents (`if GOLD drops 5%`) |
| Pay-per-inference AI agents | LLM parser bills $0.0005 USDC per parse via Nanopay |
| Autonomous merchant settlement systems where AI negotiates | Smart router fans out to 3 makers, picks the best signed quote |
| Streaming payments for content or APIs | Per-quote micropayment channel ($0.001 / quote) |
| Programmable budgeting & payment authorization | Channel deposit caps total spend; cooldown lets the user reclaim unspent USDC |

---

## Quick start

```bash
git clone <this repo>
cd Obscura
npm install
cp .env.example .env  # fill PRIVATE_KEY + VITE_WALLETCONNECT_PROJECT_ID
```

Run the test suite (no testnet needed — uses MockPyth):

```bash
npm run test:contracts   # 23/23 passing
```

Run the dev server:

```bash
npm run dev              # http://localhost:5173
```

---

## Deploy to Arc Testnet

> Pre-req: testnet USDC + EURC from https://faucet.circle.com (Arc Testnet).

```bash
npm run compile

# Deploys MockTokens + ObscuraAMM + ObscuraShield + ObscuraRFQ + ObscuraNanopay
# Auto-emits src/config/contracts.generated.ts so the frontend updates.
npm run deploy:arc

# Pushes Pyth price updates + seeds liquidity in every (asset, USDC) pool.
npm run seed:arc

# Sanity-check on-chain state.
npm run verify:arc
```

See [`lanjut.md`](./lanjut.md) for the full agent runbook (faucet steps, troubleshooting, demo script).

---

## Tech stack

- **Smart contracts**: Solidity 0.8.24, Hardhat 2.22, no OpenZeppelin (zero deps for judging clarity)
- **Frontend**: React 18 + Vite 5 + TypeScript + Wagmi v2 + Viem v2 + RainbowKit v2 + Framer Motion
- **Oracle**: Pyth Network on Arc (`0x2880aB155794e7179c9eE2e38200202908C17B43`)
- **Stablecoins**: USDC + EURC (real Arc-native) + JPYC (mock with inverted USD/JPY feed)
- **Synthetic markets**: GOLD (XAU/USD), AAPL, MSTR

---

## What's deployed

After `npm run deploy:arc` runs, addresses are written to `deployments/arc-testnet.json` and `src/config/contracts.generated.ts`. Recently-deployed addresses on Arc Testnet include:

| Contract | Address |
|---|---|
| ObscuraAMM | `0xc5557FF975FDDabDE96f84589f3F5F6a6b997E5e` |
| ObscuraShield | `0xFaF516E51ee99d446Ab31a82b58f37Bb79A92103` |
| ObscuraRFQ | `0xDE3C3B48FF6D2EA480294fB84484eA1Bc15d84D5` |
| ObscuraNanopay | (deploy with `npm run deploy:arc`) |
| Mock JPYC | `0x4AC854Eb7c95933d80B80f684109e2290A69B45D` |
| Mock GOLD | `0xA15095D167DA1b070d45E08d0Cc5425214D3041E` |
| Mock AAPL | `0x2ADbE66FbC52036ff053DC982848Ae08394014ba` |
| Mock MSTR | `0x91CDFc34Bac92079da20fBEBfA4a10603eF1dB7D` |

(View any of them on https://testnet.arcscan.app)

---

## Tests

23 tests, 100% passing. Notable cases:

- AMM quotes USDC↔GOLD at the live Pyth price minus the 0.30% fee
- AMM uses the **inverted** Pyth feed for JPYC (Pyth publishes USD/JPY, not JPY/USD)
- AMM cross-asset routing (EURC↔JPYC via USDC) charges the fee exactly once
- RFQ rejects quotes outside the Pyth ±2% deviation band
- RFQ rejects expired, replayed, or tampered quotes
- Nanopay claim accumulates monotonically across multiple settlements
- Nanopay rejects regressing totals and stale nonces
- Shield enforces per-level lock windows (Low/Medium/High)

Run with `npm run test:contracts`.

---

## Circle Product Feedback

This section is required by the submission rules and is honest, not promotional.

### Why these products?

1. **USDC**: Arc's native gas token model is the killer feature for an agentic app — predictable per-transaction costs in dollar terms, no juggling between an L2 native asset and a stablecoin.
2. **EURC**: real-world FX (USDC↔EURC) without bridges. Inverted feeds make JPYC a natural extension when paired with the right Pyth feed.
3. **Nanopayments (custom)**: We built `ObscuraNanopay.sol` against the published Nanopayments concept rather than the SDK. The pattern (channel + EIP-712 signed running total + sweep cooldown) is straightforward; an SDK that abstracts channelId derivation, monotonic nonce tracking, and signature batching would save every team a day of work.
4. **Modular Wallets**: We integrated `@circle-fin/modular-wallets-core` for passkey-secured smart accounts on Arc Testnet (`/arcTestnet` path segment). The `Circle Passkey` button in the header creates an ERC-4337 account via WebAuthn and submits **gasless USDC user operations** through Circle Gas Station. Users can sign up with a passkey instead of MetaMask and never touch native gas. **Note**: end-to-end demo is blocked by Arc Testnet enablement on our Client Key (Circle Console returned `Cannot find the entity config` when targeting Arc — see "What could be improved" #6 below). The integration is committed and tested against Polygon Amoy; it activates automatically once Circle allowlists Arc Testnet for our Client Key.
5. **StableFX**: We did not request access (testnet window was tight) but designed the RFQ flow to be FxEscrow-shaped: signed quote, oracle-bounded execution, atomic settlement. The UI calls this out explicitly when the pair is stable→stable.

### What worked well

- **Arc Testnet RPC** (`rpc.testnet.arc.network`) was rock-solid throughout development. Sub-second finality is real and changes UX assumptions in the front-end (we removed loading spinners from many flows).
- **Pyth on Arc** (`0x2880aB155794e7179c9eE2e38200202908C17B43`) just works with `getPriceUnsafe` once Hermes has pushed an update. The Hermes API is well-documented and easy to integrate.
- **Faucet UX** (`faucet.circle.com`) is clean. Multi-token (USDC + EURC) saves a lot of friction.
- **Documentation** (`docs.arc.io`) is dense but findable. The "Connect to Arc" page with the embedded React widget that auto-adds the network was a delightful surprise.

### What could be improved

1. **First-class Nanopayments SDK on Arc**: the Nanopayments concept is mentioned in the Track 4 spec but we couldn't find a deployed reference contract on Arc Testnet. We rebuilt the channel pattern from scratch. A canonical implementation (similar to Pyth's published EVM contract) would let teams plug in instead of fork.
2. **Pyth feed staleness on Arc Testnet**: feeds for niche assets (USD/JPY in our case) sometimes go several minutes between Hermes pushes during low traffic. We added a `pushPythUpdates` step into our seed script as a workaround. A scheduler or "push automation" that keeps the top-50 feeds warm on testnet would help dapps that trade those pairs.
3. **EURC faucet is per-token**: requesting USDC and EURC are separate flows. A "starter pack" that drops both in one click would shave a step from every onboarding.
4. **Wallet decimal display**: USDC's 18-decimal protocol-level vs. 6-decimal ERC-20 dual model trips up wallets that don't customize gas-token decimals. Currently MetaMask displays absurd-looking values. Documenting a recommended `decimals: 18` override (already in the docs) more prominently in connect-wallet UX would help.
5. **Modular Wallets EIP-712 / ERC-1271 docs**: the SDK supports gasless user operations beautifully but signing arbitrary EIP-712 messages with a smart account requires implementing `isValidSignature` on every counterparty contract (RFQ, Nanopay). A worked example showing the smart-account → EIP-1271 → custom-contract flow on Arc would unlock more agentic patterns.
6. **Arc Testnet enablement on Modular Wallets Client Keys**: We integrated `@circle-fin/modular-wallets-core` and the SDK ships an `arcTestnet` path segment, but our self-service Client Key in Circle Console returned `Cannot find the entity config in the system` when targeting Arc. The Console UI does not expose a "Networks" toggle on the Client Key form, so we couldn't self-allowlist Arc. The full Modular Wallets adapter, React provider, and connect button are committed to this repo (`src/lib/circleWallet.ts`, `src/hooks/useCircleWallet.tsx`, `src/components/CircleWalletButton.tsx`); they switch on automatically once Circle enables Arc Testnet for our Client Key. A self-service "Add Arc Testnet" button — or making Arc the default for new testnet keys — would be a meaningful DevX win.

### Recommendations for Circle DevX

- **Skill packs (`use-arc`, `use-usdc`, etc.)** are a great resource. Add one for Nanopayments and Modular Wallets specifically — these were the gappiest parts of our build.
- **Sample apps** for "agent with Modular Wallets + Nanopay" would unblock the whole Track 4 cohort.
- **Hermes price-push automation** as a public testnet service would eliminate the "feed cold-start" failure mode for Pyth-integrated dapps.

---

## License

MIT.
