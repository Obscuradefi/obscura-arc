# Brief: Obscura "The Shadow Layer" — Final Pre-Submission Sprint

> **Deadline acuan**: 25 Mei 2026
> **Status hari ini (19 Mei)**: 4 contracts deployed, frontend live di Vercel, 23/23 tests pass, Circle Passkey works multi-device. **6 hari window** untuk reframe + tambah differentiator + record video.

---

## Honest review of Grok's suggestions

Saya jujur dulu sebelum ambil keputusan apa yang dikerjakan:

| Saran | Verdict | Reasoning |
|---|---|---|
| 1. ZK private nanopay | ❌ **Skip** | Circuit setup 2-3 minggu. Kita sudah punya `ObscuraShield` privacy levels. Klaim ZK tanpa ZK = bohong di pitch |
| 2. On-chain agent-to-agent escrow | ✅ **Sudah ada** | `ObscuraRFQ` dengan EIP-712 + Pyth ceiling = exactly this. Rebranding 30 menit |
| 3. x402 micropayment header pattern | ✅ **Recommended** | `ObscuraNanopay` sudah 90%. Wrap jadi HTTP middleware pattern + demo. ~3 jam |
| 4. Anonymous shadow identities | ✅ **Sudah ada** | Circle Passkey smart account tidak link ke email/KYC. Narasi-nya kuat |
| 5. Multi-agent orchestration | ✅ **Recommended** | Tambah 2-3 sub-agent (researcher, executor, verifier) + visual flow. ~4 jam |
| 6. Shadow Activity dashboard | ✅ **Recommended** | Real-time tx feed dengan privacy lens. ~2 jam |
| 7. Privy login | 🟡 **Optional** | Kita sudah punya RainbowKit + Circle Passkey. Privy adds 1 more option = redundansi. Tetap dibuatkan kalau user mau, ~2-3 jam |

**Total recommended (#2 rebranding + #3 + #5 + #6 + #7)**: ~12 jam kerja efektif. Bisa dikerjakan dalam 2-3 hari kalibur.

---

## Prioritized scope (what to build first)

### TIER 1 — High impact, low risk (kerjakan dulu)

#### A. Rebrand sebagai "The Shadow Layer" (1-2 jam)

Yang sudah ada di repo, narasinya tinggal di-tune:

| Existing feature | "Shadow" narasi |
|---|---|
| ObscuraShield privacy levels | "Shadow Vault — programmable opacity" |
| Circle Passkey (no email/KYC) | "Shadow Identities — biometric without identification" |
| ObscuraRFQ Pyth-bounded | "Shadow Settlement — verifiable trust without disclosure" |
| ObscuraNanopay channels | "Shadow Streams — sub-cent flows under the surface" |
| Multi-maker fan-out | "Shadow Coordination — competing makers, hidden discovery" |

**Action**: update `Landing.tsx` hero, `README.md`, `ARCHITECTURE.md` dengan terminologi Shadow Layer. Tambah hero subtitle: *"The privacy infrastructure for the agentic economy"*.

#### B. Shadow Activity dashboard (2 jam)

Tambah tab baru `/shadow` (atau merge ke existing Portfolio):

- Real-time feed semua transaction di Arc Testnet melibatkan ObscuraAMM/Shield/RFQ/Nanopay
- Dua mode toggle:
  - **Public mode**: tampilkan amount + assets normal
  - **Shadow mode**: tampilkan hanya commitment hashes + opaque flow indicators (`◇ → ◇ via maker[?]`)
- Counter "Shadow volume in last 1h" + "Active shadow channels"

File baru: `src/features/shadow/ShadowActivityTab.tsx`

#### C. x402-style micropayment middleware demo (3 jam)

Buat HTTP server tipis di `scripts/x402-demo-server.cjs` yang demonstrasikan pay-per-API-call:

- Endpoint `GET /quote/:asset` returns 402 Payment Required dengan header `x-payment-required: 0.001 USDC via 0x<nanopay-channel>`
- Browser-side helper di `src/lib/x402Client.ts`: auto-sign nanopay claim → set header → retry request → returns price
- Demo halaman `/x402` yang tunjukkan "click button → API call → 0.001 USDC charged → response received"

Use case nyata: agent fetch oracle prices dari pihak ketiga, pakai x402 untuk pay-per-call.

### TIER 2 — Bigger differentiator (kerjakan kalau ada waktu)

#### D. Multi-agent orchestration demo (4 jam)

Extend `SwapAgent.tsx` jadi orchestrator yang spawn 3 sub-agents dengan personas berbeda:

```
User intent: "swap 100 USDC to MSTR if price drops 2%"
  ├── 🔍 Researcher Agent — watch Pyth feed, compute trigger
  │       (charges nanopay for each price check)
  ├── 💰 Executor Agent — fan out RFQ when triggered
  │       (charges nanopay for each maker quote)
  └── ✅ Verifier Agent — check tx settled correctly
          (charges nanopay for verification)

Total cost: ~$0.005 USDC distributed across 3 sub-agents
```

UI: tampilkan 3 agent boxes dengan live status + nanopay counter masing-masing.

File baru: `src/features/agents/MultiAgentOrchestrator.tsx`

#### E. Privy login option (2-3 jam)

Tambah Privy sebagai third wallet path (selain RainbowKit + Circle Passkey):

```bash
npm install @privy-io/react-auth @privy-io/wagmi
```

Setup:
- Buat app ID di console.privy.io
- Wrap App dengan `<PrivyProvider>`
- Update `useEffectiveAccount` jadi: Circle Passkey > Privy > RainbowKit
- Login methods Privy yang dipakai: email, Google, Apple, embedded wallet
- Tombol "Login with Email" di header (selain RainbowKit dan Circle Passkey)

**Tradeoff jujur**:
- ✅ User onboarding paling mudah (email/Google) untuk audience non-crypto
- ❌ Add 1 more wallet path = lebih kompleks codebase
- ❌ Privy embedded wallet beda dari Circle Smart Account = saldo terpisah lagi
- 🟡 Untuk demo Track 4 (Agentic Economy), narasi Modular Wallets + paymaster sebenarnya lebih kuat dari Privy

**Rekomendasi**: kalau audience video demo non-crypto, tambah Privy untuk simplicity. Kalau audience teknis (Circle judges = teknis), skip.

### TIER 3 — Polish (kalau masih ada waktu)

#### F. Shadow flow visualization (2 jam)

Animasi flow untuk RFQ + Nanopay di SwapTab:
- Saat fan-out: 3 quotes flowing dari maker boxes ke router
- Saat settle: USDC flowing dari taker → maker
- Saat charge: tiny dots flowing dari user → service (nanopay)

File: `src/components/ShadowFlowAnimation.tsx`

---

## Deliverable timeline (6 days)

```
DAY 1 (Tue 20 Mei) — Rebrand + Shadow tab
  AM:  A. Rebrand "The Shadow Layer" copy + visuals
  PM:  B. Shadow Activity dashboard

DAY 2 (Wed 21 Mei) — x402 middleware
  AM:  C.1 Server endpoint dengan 402 header
  PM:  C.2 Browser client + demo page

DAY 3 (Thu 22 Mei) — Multi-agent (atau Privy)
  AM:  D.1 Sub-agent classes + nanopay charging
  PM:  D.2 Orchestrator UI + visualization

DAY 4 (Fri 23 Mei) — End-to-end test + polish
  AM:  Test semua flow di Vercel
  PM:  Polish UI, fix edge cases

DAY 5 (Sat 24 Mei) — Record video
  AM:  Pre-record (fund accounts, warm Pyth feeds, rehearsal)
  PM:  Record + edit + upload

DAY 6 (Sun 25 Mei) — Submit
  AM:  Final review docs (README, ARCHITECTURE, lanjut)
  PM:  Submit hackathon form, screenshots, monitor email
```

---

## Privy implementation brief (kalau diputuskan tambah)

### Files baru / diubah

```
package.json                        +deps: @privy-io/react-auth, @privy-io/wagmi
src/lib/privyConfig.ts              NEW: Privy app config + chain setup
src/main.jsx                        wrap dengan <PrivyProvider> (di luar WagmiProvider)
src/hooks/useEffectiveAccount.ts    add Privy as 2nd source (after Circle, before wagmi)
src/components/PrivyLoginButton.tsx NEW: tombol "Sign in with Email" di header
src/components/AppHeader.tsx        tambah <PrivyLoginButton /> di samping CircleWalletButton
.env.example                        +VITE_PRIVY_APP_ID
```

### Privy + Circle conflict resolution

Source priority di `useEffectiveAccount`:

```ts
1. Circle Modular Wallet session (passkey) -> highest priority
2. Privy user (email/Google) wallet -> middle
3. Wagmi (RainbowKit / MetaMask) -> fallback
```

Kalau user login multiple, yang highest yang dipakai. Disconnect button per wallet provider.

### Funding flow consideration

Privy embedded wallet = address baru lagi, terpisah dari Circle Smart Account dan RainbowKit EOA. User yang login via email harus faucet ke address Privy itu. Documentation harus jelas ini.

### Kapan Privy benar-benar membantu

- ✅ Demo ke audience yang tidak punya MetaMask/passkey-capable device
- ✅ User onboarding tanpa crypto background
- ❌ Hackathon judges = mostly already crypto-native, mereka prefer lihat Modular Wallets
- ❌ Mainnet production = lebih ke "yet another wallet abstraction" kompetisi

**Final call**: optional. Kerjakan kalau Tier 1 + 2 (A-D) selesai dengan waktu sisa, atau skip kalau timeline ketat.

---

## Submission narasi update untuk Track 4

Update field di submission form:

```
Title: Obscura — The Shadow Layer for Agentic Economy on Arc

Tagline: Privacy infrastructure for autonomous stablecoin agents.

Description (max 200 words):
  Obscura is the Shadow Layer for the agentic economy on Arc Testnet:
  programmable privacy primitives that let AI agents discover, negotiate,
  and settle stablecoin trades without exposing identity, intent, or flow.
  
  Three synthetic RFQ makers fan out and return EIP-712 signed quotes
  bounded by Pyth ±2%, defending users against compromised maker keys.
  USDC nanopayment channels let agents bill themselves for sub-cent
  per-quote and per-LLM-inference work — settled on-chain in batches when
  economic. Circle Modular Wallets enable passkey-secured smart accounts
  with no email or KYC, deploying gaslessly via Gas Station. Shield
  protocol shrouds positions with Low/Medium/High lock windows for
  programmable opacity. EURC and JPYC stablecoin pairs route through an
  FxEscrow-compatible flow.
  
  Built on a fully Pyth-priced AMM (no x*y=k slippage) with cross-asset
  routing through USDC. 23/23 contract tests passing. Live on Arc Testnet.

Circle products: USDC, EURC, Modular Wallets, Nanopayments, StableFX (conceptual)
```

---

## Yang JANGAN dikerjakan

1. ZK proofs / circuits — too far for window
2. Mainnet deploy — testnet lebih dari cukup
3. Audit / formal verification — tidak masuk submission requirement
4. Mobile app native — webview / responsive web cukup
5. Tambah chain support lain (Polygon, Base, dll) — fokus ke Arc

---

## Final go/no-go decision tree

```
Apakah video sudah bisa direkam dengan flow saat ini?
  YES → minimum: A (rebrand) + record + submit. Skip B-G. Done.
  NO/maybe → kerjakan B (Shadow tab) + C (x402) untuk meningkatkan demo

Apakah audience video demo crypto-native?
  YES → skip Privy
  NO → tambah Privy

Apakah ada waktu lebih dari 4 hari untuk kerja?
  YES → kerjakan A + B + C + D
  NO → kerjakan A + B saja
```

Recommended path: **A + B + C + D, skip Privy, skip ZK**. 12 jam kerja efektif spread over 3 hari, sisa 3 hari untuk video + submit + buffer.

---

## Reference files yang akan diubah

```
src/pages/Landing.tsx              — rebrand hero
src/components/AppHeader.tsx       — tambah link "Shadow Activity" tab
src/features/shadow/               — NEW folder
  ShadowActivityTab.tsx
  ShadowFlowAnimation.tsx (Tier 3)
src/lib/x402Client.ts              — NEW
scripts/x402-demo-server.cjs       — NEW
src/features/agents/               — NEW folder (Tier 2)
  MultiAgentOrchestrator.tsx
  agentPersonas.ts
README.md                          — narasi Shadow Layer
ARCHITECTURE.md                    — tambah Shadow Layer diagram section
lanjut.md                          — update submission checklist
.env.example                       — +VITE_PRIVY_APP_ID kalau Privy ditambah
```

---

## Action sekarang

1. Baca brief ini sampai habis
2. Decide: A + B + C only, atau full A + B + C + D, atau plus Privy?
3. Kasih tahu saya pilihan, saya start implement Tier 1 (A + B) langsung
