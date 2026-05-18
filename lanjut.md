# Lanjut: Instruksi untuk Antigravity Agent

> **REVISI 2026-05-18 (v6)** — FINAL SUBMISSION CHECKLIST:
> - Code work selesai. Vercel live di https://obscuraarc1.vercel.app
> - 4 contracts deployed di Arc Testnet (AMM/Shield/RFQ/Nanopay), 23/23 tests pass
> - Circle Passkey approve + swap **sudah bisa**. Modular Wallets aktif via Gas Station paymaster
> - **Yang masih wajib**: end-to-end test live + record video demo + submit form

---

## ⚡ FINAL 3-PHASE PLAN UNTUK SUBMISSION (~2 jam total)

### PHASE 1 — End-to-end test live (~15-30 menit)

Target: pastikan tidak ada bug yang ketemu di tengah video recording.

```
Action checklist (urut, jangan dilewat):

1. Buka https://obscuraarc1.vercel.app/app di Chrome/Edge profile baru (atau incognito)
2. Klik "Circle Passkey" → "Create new passkey" → OS biometric prompt
3. Setelah connect, copy smart account address dari tombol header
4. Buka https://faucet.circle.com → Arc Testnet
5. Paste smart account address, request:
   - 30 USDC (untuk swap + Pyth fee)
   - 5 EURC (untuk demo stable FX)
6. Tunggu konfirmasi (sub-detik di Arc)
7. Test swap kecil:
   - Buka Swap tab
   - Input: 1 USDC → GOLD
   - Klik Approve USDC → passkey prompt
   - Tunggu confirm di-bundler (5-10 detik)
   - Klik Execute swap (gasless) → passkey prompt
   - Verify: tx muncul di header link "Gasless tx", buka ArcScan
8. Test Wake Oracle (kalau Pyth stale):
   - Klik tombol "Wake Oracle" di header
   - passkey prompt → tunggu confirm
   - Console log harus ada [pythUpdater]
9. Faucet mock token via tombol Faucet header
   - Klik beberapa kali → cycle GOLD/AAPL/MSTR/JPYC ke smart account
10. Test stable FX:
    - Swap 1 USDC → EURC
    - Verify: badge biru "Stablecoin FX pair detected" muncul
11. Test inverse feed:
    - Swap 1 USDC → JPYC
    - Output ≈ 150 JPYC (USD/JPY ~150 inverted)
12. Test Shield:
    - Buka Shield tab
    - Asset: USDC, level: HIGH, amount: 1
    - Approve → Shield → countdown 24h muncul
13. Test AI Agent:
    - Klik tombol "AI" pojok kanan bawah
    - Type: "swap 2 USDC to GOLD"
    - Preview muncul → Confirm
14. Test Nanopay badge:
    - Setelah ~3 swap, badge kuning "Nanopayments active: $0.00X across N services" muncul di Swap card
15. Buka Portfolio tab → verify saldo + history activity
```

**Issue umum di Phase 1**:

| Gejala | Fix |
|---|---|
| Approve passkey jalan tapi Execute swap fail | Cek console log `[pythSwap]` + `[circle]`, paste ke saya |
| Quote 0 / "Pyth oracle stale" | Klik Wake Oracle dulu (juga via passkey), lalu retry |
| Smart account 0 USDC error AA21 | Faucet ulang ke address smart account |
| Tab blank / browser console error | Hard refresh `Ctrl+Shift+R` atau coba incognito |
| Allowance stuck di Approve walau sudah confirm | Refresh halaman (allowance read butuh ~1-2 block sebelum frontend re-detect) |

---

### PHASE 2 — Record demo video (~60-90 menit)

Target: 3-4 menit MP4, 1080p, dengan voice-over.

**Tools**:
- OBS Studio (gratis): https://obsproject.com
- Atau Loom (paid, tapi ada free tier untuk video <5 menit)

**Pre-recording checklist**:
- Smart account funded (USDC, EURC, mock GOLD/AAPL/MSTR/JPYC)
- Pyth feeds fresh (klik Wake Oracle dulu sebelum mulai)
- Browser di full-screen, hide bookmarks bar
- Tutup tab/aplikasi yang notif (Discord, Slack, dll)
- Test mic 5 detik dulu

**Script (timeline 3:30 total)**:

| 0:00–0:15 | Logo + tagline |
| 0:15–0:30 | Connect via Circle Passkey, tunjukkan smart account address di header |
| 0:30–1:00 | **Demo 1**: Faucet mock GOLD via tombol header → tunjukkan `Gasless tx` link → buka ArcScan, tunjukkan tx submitter = bundler, paymaster sponsor gas |
| 1:00–1:45 | **Demo 2**: Swap 5 USDC → GOLD via passkey → quote panel hijau "AMM (Pyth-priced)" → tunjukkan harga match Pyth real-time |
| 1:45–2:15 | **Demo 3**: Swap 1 USDC → EURC → badge biru FxEscrow muncul → klik link, buka FxEscrow di ArcScan |
| 2:15–2:45 | **Demo 4**: AI Agent → conditional intent "buy GOLD with 5 USDC if drops 1%" → watcher armed |
| 2:45–3:15 | **Demo 5**: Nanopay badge update → console log signed claims → narasi sub-cent billing |
| 3:15–3:30 | Closing: GitHub repo URL + Vercel URL + thank you |

**Voice-over key phrases** (jangan miss):
- "Autonomous stablecoin agent on Arc"
- "Multi-maker RFQ bounded by Pyth ±2%"
- "Gasless via Circle Modular Wallets and Gas Station"
- "Sub-cent USDC nanopayments"
- "Conditional intents that watch and execute"
- "Built for Track 4: Best Agentic Economy Experience"

**Editing minimal**:
- Trim awal/akhir
- Add 1 fade-in title card (opsional)
- Volume normalize voice-over
- Export 1080p MP4
- Upload ke YouTube unlisted atau Loom

---

### PHASE 3 — Submit ke hackathon portal (~15 menit)

```
Submission form fields:

Title: Obscura — Autonomous Stablecoin Agent on Arc
Track: Track 4 — Best Agentic Economy Experience on Arc
Email: <isi Circle Developer Account email kamu>

Circle products checklist (centang semua):
  [x] USDC
  [x] EURC
  [x] Modular Wallets
  [x] Nanopayments
  [x] StableFX (conceptual)

Live demo URL: https://obscuraarc1.vercel.app
GitHub repo: https://github.com/Obscuradefi/obscura-arc
Architecture: link ke ARCHITECTURE.md di repo
Video URL: <link YouTube/Loom kamu>

Description (max 200 words):
  Obscura is an autonomous stablecoin agent on Arc Testnet that researches,
  negotiates, and settles trades on behalf of users without per-step wallet
  popups. Three synthetic RFQ makers fan out and return EIP-712 signed
  quotes; an on-chain Pyth ±2% deviation cap defends users against
  compromised maker keys. USDC nanopayments bill the agent for per-quote
  and per-LLM-call work at sub-cent rates. Circle Modular Wallets enable
  passkey-secured smart accounts with Gas Station-sponsored gas. EURC and
  JPYC stablecoin pairs route through an FxEscrow-compatible flow. Built
  on a fully Pyth-priced AMM with cross-asset routing through USDC.

Circle Product Feedback: <copy section dari README.md>
```

**Setelah submit, jangan tutup tab**. Screenshot konfirmasi submission untuk arsip.

---

## ⚙️ Reference cepat

```bash
# Run hardhat tests
npm run test:contracts          # 23/23 passing

# Re-deploy semua kontrak (kalau perlu fresh addresses)
npm run deploy:arc
npm run seed:arc                # push Pyth + seed liquidity
npm run verify:arc

# Dev server lokal (untuk debug pre-recording)
npm run dev                     # http://localhost:5173

# Production build (untuk Vercel auto-deploy)
git push origin main            # Vercel auto-build dari commit terbaru
```

## ⚠️ Yang JANGAN diubah lagi sebelum submission

- `contracts/*.sol` — sudah tested 23/23
- `src/lib/circleWallet.ts` (gas params + account argument) — baru saja work, jangan touch
- `src/hooks/useUnifiedSendTx.ts` — single source of truth untuk wallet routing
- `src/hooks/useEffectiveAccount.ts` — passkey priority logic

## Realistic placement assessment

Per evaluasi: **top 3 di Track 4** kalau video demo bagus + flow live tanpa hiccup.

Differentiator yang harus ditonjolkan di video:
1. Pyth-priced AMM (bukan x*y=k)
2. Multi-maker RFQ dengan oracle ceiling
3. Custom Nanopay contract dengan EIP-712
4. Modular Wallets gasless flow
5. Inverse Pyth feed (JPYC = USD/JPY inverted)

---

## ⏬ Sisanya di file ini hanya reference detail. Bagian utama sudah di atas.

---



## TASK LIST UNTUK ANTIGRAVITY AGENT (PRIORITAS BERURUTAN)

### A. Re-deploy contracts dengan ObscuraNanopay (kalau belum)

```bash
cd D:\website\hackathin\Obscura
npm run compile
npm run test:contracts        # harus 23/23 passing
npm run deploy:arc            # deploy 5 kontrak + auto-update src/config/contracts.generated.ts
npm run seed:arc              # push Pyth + seed liquidity
npm run verify:arc
```

> Re-deploy menghasilkan address baru. Itu OK — frontend baca `contracts.generated.ts` otomatis.

### B. Push ke GitHub + deploy Vercel

```bash
git add -A
git status                    # cek tidak ada .env atau secrets
git commit -m "Track 4 submission: Pyth-priced AMM + multi-maker RFQ + Nanopayments + Modular Wallets adapter"
git push origin main          # atau branch yang sesuai

# Pertama kali deploy ke Vercel:
npm install -g vercel
vercel login                  # interactive, pakai email/GitHub
vercel                        # interactive setup (pilih scope, link ke project, framework auto-detect = Vite)
vercel --prod                 # deploy production
```

Setelah pertama kali, redeploy cukup `vercel --prod`.

### C. Set environment variables di Vercel Dashboard

Buka [vercel.com](https://vercel.com) → Project → Settings → Environment Variables. Tambahkan **untuk Production + Preview + Development**:

| Variable | Value | Catatan |
|---|---|---|
| `VITE_WALLETCONNECT_PROJECT_ID` | dari cloud.reown.com | Wajib supaya WalletConnect bekerja |
| `VITE_RFQ_MAKER_PRIVATE_KEY` | sama dengan `PRIVATE_KEY` di local | Wajib untuk RFQ multi-maker |
| `VITE_RFQ_MIN_USD` | `1000` | Trade size threshold; ubah ke `100000` kalau mau demo production behavior |
| `VITE_JATEVO_API_KEY` | dari jatevo.id (kalau ada) | Optional, fallback ke regex |
| `VITE_JATEVO_BASE_URL` | dari `.env` local kalau ada | Optional |
| `VITE_JATEVO_MODEL` | dari `.env` local kalau ada | Optional |
| `VITE_CIRCLE_CLIENT_KEY` | `TEST_CLIENT_KEY:e2aaec...` | Optional (Modular Wallets) |
| `VITE_CIRCLE_CLIENT_URL` | `https://modular-sdk.circle.com/v1/rpc/w3s/buidl` | Optional |
| `VITE_CIRCLE_PASSKEY_NAME` | `obscura-agent` | Optional |
| `VITE_ARC_RPC_URL` | `https://rpc.testnet.arc.network` | Optional |

> **JANGAN** set `PRIVATE_KEY` di Vercel — itu untuk Hardhat lokal saja.

Setelah set env vars, **redeploy** supaya values terambil:
```bash
vercel --prod --force
```

### D. Tambah domain Vercel ke Circle Console (untuk Modular Wallets)

1. Setelah Vercel deploy, copy domain (e.g. `obscura-xxxx.vercel.app`)
2. Buka https://console.circle.com → Wallets → Modular → Client Keys
3. Edit Client Key kamu (`TEST_CLIENT_KEY:e2aaec…`)
4. Tambah domain Vercel ke **Allowed Domain** (selain `localhost`)
5. Save

> Selama Circle belum enable Arc Testnet, tombol passkey tetap akan disabled. Tidak ada cara self-service untuk enable Arc — perlu email `customer-support@circle.com`.

### E. Test Vercel deployment end-to-end

Buka URL Vercel (e.g. `https://obscura-xxxx.vercel.app`):

1. ✅ Connect wallet via RainbowKit
2. ✅ Header tampil "Arc Testnet"
3. ✅ Faucet tombol (cycle mock tokens)
4. ✅ Swap kecil (5 USDC → GOLD): quote panel hijau "AMM (Pyth-priced)" + explainer "Trade < $1,000 threshold"
5. ✅ Swap besar (1500 USDC → MSTR): quote panel ungu, 3 quotes muncul, RFQ settle
6. ✅ Stable pair (USDC → EURC): badge biru "Stablecoin FX pair detected" + link FxEscrow
7. ✅ Inverse feed (USDC → JPYC): output ≈ 150 JPYC per 1 USDC
8. ✅ Shield 1 USDC HIGH: countdown 24h
9. ✅ AI Agent: `swap 2 USDC to GOLD` → preview → confirm
10. ✅ Conditional intent: `buy GOLD with 5 USDC if GOLD drops 1%` → watcher start
11. ✅ Nanopay badge muncul setelah ~3 swap

### F. Record demo video (3-4 menit)

Lihat **Phase 5** di bawah untuk script lengkap.

Tools: OBS Studio (gratis) atau Loom (paid). Output: MP4 1080p.

### G. Submit ke hackathon portal

Lihat **Phase 6** di bawah untuk checklist submission.

## TROUBLESHOOTING CEPAT

| Gejala | Fix cepat |
|---|---|
| Vercel build fail "process is not defined" | Set Node.js version 20+ di Vercel Project Settings |
| Vercel build fail "Cannot find module @circle-fin/modular-wallets-core" | Pastikan `package-lock.json` di-commit, jangan pakai `npm ci` flag yang skip optional deps |
| Frontend kosong setelah deploy, "Cannot read property of undefined" | Env vars belum di-set. Cek Vercel Dashboard → Environment Variables |
| Swap revert "AMM: pyth\<=0" | Pyth feed stale di Arc Testnet. Run `npm run seed:arc` lokal (akan push ulang prices) |
| Tombol Modular Wallets tampil "Passkey (Arc pending)" | Normal kalau Circle belum allowlist Arc untuk Client Key. Skip aja, demo via RainbowKit |
| Tx revert tanpa error message | Open ArcScan tx page, lihat decoded revert reason. Biasanya `RFQ: deviation` atau `AMM: slippage` |
| Faucet button gagal "execution reverted" | Mock tokens belum deployed atau ABI lama. Re-run `npm run deploy:arc` |

## KALAU SEMUA SUDAH OK

- Tag commit: `git tag -a hackathon-submission -m "Final submission for Track 4"`
- Push tag: `git push origin hackathon-submission`
- Submit di portal hackathon dengan link Vercel + GitHub + video

---

## Sisanya (Phase 1-7) di bawah hanya untuk reference detail. Bagian utama sudah di atas.

---

## Quick reference

| Item | Value |
|---|---|
| **Track submission** | 4 — Best Agentic Economy Experience on Arc |
| **Working dir** | `D:\website\hackathin\Obscura` |
| **Chain** | Arc Testnet (`5042002`) |
| **RPC** | `https://rpc.testnet.arc.network` |
| **Pyth contract** | `0x2880aB155794e7179c9eE2e38200202908C17B43` |
| **USDC** | `0x3600000000000000000000000000000000000000` (real native) |
| **EURC** | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (real native) |
| **JPYC** | mock, deployed by `deploy.cjs` |
| **StableFX FxEscrow** | `0x867650F5eAe8df91445971f14d89fd84F0C9a9f8` (read-only reference) |
| **Modular Wallets path** | `/arcTestnet` (Circle SDK config) |
| **Pyth feeds (Hermes)** | EUR/USD, USD/JPY (inverted), XAU/USD, AAPL, MSTR |

Submission form fields ([circle hackathon submission docs](https://github.com/circlefin/arc)):

- Title: **Obscura — Autonomous Stablecoin Agent on Arc**
- Track: **Best Agentic Economy Experience on Arc**
- Email: <isi dengan Circle Developer Account email>
- Circle products: **USDC** ✅, **EURC** ✅, **Modular Wallets** ✅, **Nanopayments** ✅ (custom-built reference impl), **StableFX** 🟡 conceptual
- Functional MVP: Vercel/Netlify URL (TBD)
- Architecture diagram: `ARCHITECTURE.md` ✅
- Video: TBD (lihat Phase 5)
- Repo: this repo
- Circle Product Feedback: di README.md ✅

---

## Phase 1 — Provisioning (sudah sebagian)

Wallet sudah dibuat: `0xBC0F85275613FAcB31773b5D8b44C803cdeCa06e` (deployer). Kalau wallet hilang, generate ulang dan update `.env`.

### Funding USDC + EURC

1. https://faucet.circle.com → Arc Testnet
2. Paste deployer address
3. Request **30 USDC**
4. Switch token → **5 EURC** (untuk seed pool EURC)

### Set up Circle Modular Wallets (untuk gasless demo)

Ini step untuk v4. Tanpa ini, dapp tetap berfungsi via RainbowKit, tapi demo Track 4 kurang impactful.

> **STATUS PER 2026-05-17**: Modular Wallets self-service Client Key di Circle Console **belum enable Arc Testnet**. Saat coba register passkey, SDK return `Cannot find the entity config in the system` (RPC 401 di endpoint `/arcTestnet`). UI Console tidak punya toggle "Add Arc Testnet" pada form Client Key. Sampai Circle allowlist Arc, tombol "Circle Passkey" di header tampil disabled dengan label `Passkey (Arc pending)`. Adapter sudah ditulis lengkap (`src/lib/circleWallet.ts`, `useCircleWallet.tsx`, `CircleWalletButton.tsx`), aktif otomatis begitu Circle enable Arc.
>
> **Dokumentasikan ini di submission Circle Product Feedback** (sudah di README) — itu feedback berharga buat Circle DevX team.

Kalau kamu punya kontak Circle dev rep / sales, minta enable Arc Testnet untuk Client Key kamu. Email `customer-support@circle.com` dengan subject "Arc Testnet Modular Wallets enablement for Stablecoin Commerce Stack Challenge" dan sebut Client Key prefix kamu (`TEST_CLIENT_KEY:e2aaec…`).

Step Console (kalau allowlist sudah berhasil):

1. Sign up di https://console.circle.com (gratis untuk testnet)
2. Navigate ke **Wallets** → **Modular** → **Client Keys** → **Create Client Key**
3. Pilih **Testnet** environment
4. **Set Allowed Domain**:
   - Untuk dev local: `localhost`
   - Untuk demo Vercel: `obscura.vercel.app` (atau apapun domain final-mu)
5. Skip iOS dan Android sections
6. Copy **Client Key** (format: `TEST_CLIENT_KEY:abc...:xyz...`)
7. Copy **Client URL** (`https://modular-sdk.circle.com/v1/rpc/w3s/buidl`)
8. Paste ke `.env`:

   ```ini
   VITE_CIRCLE_CLIENT_KEY=TEST_CLIENT_KEY:...
   VITE_CIRCLE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl
   VITE_CIRCLE_PASSKEY_NAME=obscura-agent
   ```

> **Catatan**: Passkey terkait domain — passkey yang dibuat di `localhost` tidak bisa dipakai di Vercel. Tambahkan kedua domain di Circle Console sebelum production deploy.

### Isi `.env`

```ini
PRIVATE_KEY=0x<deployer key>
VITE_WALLETCONNECT_PROJECT_ID=<dari https://cloud.reown.com>

# WAJIB: maker key = deployer (auto-registered sebagai maker pertama)
VITE_RFQ_MAKER_PRIVATE_KEY=0x<sama dengan PRIVATE_KEY>

# Optional: extra maker addresses (Jump + Citadel personas)
RFQ_EXTRA_MAKERS=

# Optional: LLM intent parser (kalau tidak set, fallback ke regex)
VITE_JATEVO_API_KEY=

# Circle Modular Wallets (passkey + gasless USDC via Gas Station)
# Buat di https://console.circle.com -> Wallets -> Modular -> "Create Client Key"
# Set "Passkey Domain" ke localhost untuk dev, atau ke domain Vercel kamu untuk production
VITE_CIRCLE_CLIENT_KEY=TEST_API_KEY:abc123:xyz...
VITE_CIRCLE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl
VITE_CIRCLE_PASSKEY_NAME=obscura-agent
```

> **Tanpa `VITE_CIRCLE_CLIENT_KEY` + `VITE_CIRCLE_CLIENT_URL`**: tombol "Circle Passkey" di header tampil sebagai disabled dengan tooltip "(not configured)". Dapp tetap berfungsi via RainbowKit. Jadi setting ini opsional tapi **highly recommended** untuk Track 4 demo.

**Cara isi `RFQ_EXTRA_MAKERS`** (untuk demo multi-maker yang impressive):

```bash
# Run sekali untuk derive addresses dari maker pool:
node -e "
const { privateKeyToAccount } = require('viem/accounts');
const seed = process.env.PRIVATE_KEY;
const derive = (s, salt) => {
  const hex = s.slice(2).toLowerCase();
  const high = parseInt(hex.slice(0,4),16) ^ (salt & 0xffff);
  return '0x' + high.toString(16).padStart(4,'0') + hex.slice(4);
};
console.log('Maker 0 (deployer):', privateKeyToAccount(seed).address);
console.log('Maker 1 (Jump)   :', privateKeyToAccount(derive(seed, 0xa11c + 0x100)).address);
console.log('Maker 2 (Citadel):', privateKeyToAccount(derive(seed, 0xa11c + 0x200)).address);
"
```

Salin Maker 1 + Maker 2 ke `RFQ_EXTRA_MAKERS` (comma-separated) sebelum deploy.

---

## Phase 2 — (Re-)Deploy ke Arc Testnet

Karena ObscuraNanopay BARU ditambahkan, kontrak yang sudah deployed (AMM/Shield/RFQ) **tetap berfungsi**, tapi Nanopay belum live. Re-deploy biar lengkap:

```bash
# 1. Compile + test
npm run compile
npm run test:contracts        # harus 23/23 passing

# 2. Re-deploy semua kontrak (akan generate addresses baru!)
#    Otomatis update src/config/contracts.generated.ts
RFQ_EXTRA_MAKERS=0xMAKER1,0xMAKER2 npm run deploy:arc

# 3. Push Pyth + seed liquidity
npm run seed:arc

# 4. Verify
npm run verify:arc
```

> **PENTING**: re-deploy menghasilkan address baru. Frontend otomatis pakai `contracts.generated.ts` jadi tidak perlu edit manual. Tapi kalau user sudah bookmark contract address lama di ArcScan, kasih tahu mereka address baru.

> **Alternatif: hanya deploy Nanopay**, sisanya tetap. Ini lebih hemat gas tapi perlu script kustom. Kalau perlu, tambahkan `scripts/deployNanopayOnly.cjs` yang baca address existing dari `deployments/arc-testnet.json` lalu deploy hanya Nanopay + update generated.ts.

### Expected output

Setelah `verify:arc`:
- 4 mock tokens deployed: JPYC, GOLD, AAPL, MSTR
- ObscuraAMM, ObscuraShield, ObscuraRFQ, **ObscuraNanopay** deployed
- 3 RFQ makers registered (Wintermute / Jump / Citadel personas)
- Pools seeded: EURC, JPYC, GOLD, AAPL, MSTR
- Pyth feeds pushed (di Hermes)

---

## Phase 3 — Run dapp + verify

```bash
npm run dev   # http://localhost:5173
```

### Test scenarios untuk demo recording

| Step | Aksi | Verifikasi |
|---|---|---|
| 1 | Connect wallet via **RainbowKit** atau **Circle Passkey** (tombol biru di header) | Header "Arc Testnet". Kalau Circle Passkey: passkey prompt muncul, smart account address tampil sebagai "Passkey · 0x…" |
| 2 | Faucet beberapa kali | Tokens masuk Portfolio |
| 3 | **Demo 1 — AMM swap (gasless via Modular Wallets)**: kalau pakai Circle Passkey, swap USDC → GOLD eksekusi sebagai user operation, bayar gas via Circle Gas Station | Tx hash di ArcScan ada. Saldo native USDC user **tidak berkurang untuk gas**, hanya berkurang untuk amount swap |
| 4 | **Demo 2 — Multi-maker RFQ**: USDC → MSTR (10 USDC) | Routing panel ungu "RFQ · Wintermute" (atau Jump/Citadel). 3 quotes competing di console |
| 5 | **Demo 3 — Stable FX**: USDC → EURC (1 USDC) | Badge biru "Stablecoin FX pair detected" + link ke FxEscrow. Output ≈ 0.927 EURC |
| 6 | **Demo 4 — Inverse feed JPY**: USDC → JPYC (1 USDC) | Output ≈ 150 JPYC. Pyth USD/JPY feed di-invert otomatis |
| 7 | **Demo 5 — Nanopay billing**: setelah ~5 swap, badge kuning muncul: "Nanopayments active: $0.0035 across 3 services" | Browser console log `[nanopay] charge` per quote |
| 8 | **Demo 6 — Conditional intent**: AI Agent → `buy GOLD with 5 USDC if GOLD drops 1%` | Watcher start, polling tiap 30s |
| 9 | **Demo 7 — Privacy**: Shield 1 USDC HIGH | Entry muncul dengan countdown 24h |

### Issue umum

| Gejala | Sebab | Fix |
|---|---|---|
| Quote panel "RFQ skipped: No maker configured" | `VITE_RFQ_MAKER_PRIVATE_KEY` belum di-set | Isi `.env` |
| Quote panel "RFQ skipped: signs as 0x… but contract expects 0x…" | Maker key beda dari yang di-register | Pakai deployer key, atau `setMaker` manual via ArcScan |
| RFQ revert `RFQ: deviation` | Pyth feed stale, drift > 200 bps | Re-run `npm run seed:arc` |
| RFQ revert `RFQ: bad maker` (untuk Maker 1/2) | `RFQ_EXTRA_MAKERS` tidak di-set saat deploy | Re-run deploy dengan env var, atau `setMaker(addr, true)` manual |
| Nanopay badge tidak muncul | Nanopay belum di-deploy (`OBSCURA_NANOPAY_ADDRESS = 0x000...`) | Re-run `npm run deploy:arc` |
| Frontend pakai address lama setelah re-deploy | Cache | Restart `npm run dev` |
| Swap EURC fail | Deployer belum funded EURC | Faucet di faucet.circle.com → Arc Testnet → EURC |
| Tombol "Circle Passkey" tampil "(not configured)" | `VITE_CIRCLE_CLIENT_KEY` / `VITE_CIRCLE_CLIENT_URL` belum di-set | Buat client key di console.circle.com → Wallets → Modular |
| Passkey prompt error `SecurityError` | Domain di Circle Console tidak match domain dapp | Set Passkey Domain di console.circle.com ke `localhost` (dev) atau ke domain Vercel kamu |
| Passkey error `InvalidStateError` | Username sudah pernah register di domain ini | Klik "Use existing passkey" instead of "Create new" |
| User op gagal dengan AA21 | Smart account belum punya saldo USDC native untuk gas (kalau paymaster off) | Pastikan `paymaster: true` di `sendUserOperation` (sudah default di adapter) |
| Pyth EUR/USD atau USD/JPY tidak return harga | Hermes belum push update untuk feed itu di Arc | `npm run seed:arc` (akan push semua feed sekaligus) |

---

## Phase 4 — Production deploy

Repo include `vercel.json` + `netlify.toml`.

### Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Set environment variables di Vercel dashboard:
- `VITE_WALLETCONNECT_PROJECT_ID`
- `VITE_RFQ_MAKER_PRIVATE_KEY`
- `VITE_JATEVO_API_KEY` (optional)
- `VITE_CIRCLE_CLIENT_KEY` (untuk Modular Wallets)
- `VITE_CIRCLE_CLIENT_URL` (untuk Modular Wallets)

### Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

Same env variables.

> **PENTING untuk Modular Wallets**: setelah deploy, masuk ke Circle Console → Wallets → Modular → Edit Client Key, lalu **update Passkey Domain** ke domain Vercel/Netlify kamu (e.g. `obscura.vercel.app`). Tanpa ini, passkey yang sudah dibuat di `localhost` tidak akan bekerja di production.

> **WARNING**: Jangan commit private key ke git. Cek `.env` ada di `.gitignore` (sudah).

---

## Phase 5 — Demo video (script + recording)

**Target durasi**: 3-4 menit. Format: MP4, 1080p, voice-over.

**Tools**: OBS Studio (gratis) atau Loom (paid).

### Script (per scene)

| Time | Scene | Voice-over |
|---|---|---|
| 0:00–0:15 | Logo + tagline | "Obscura is an autonomous stablecoin agent on Arc by Circle. It researches, negotiates, and settles trades for you using oracle-bounded RFQ and USDC nanopayments." |
| 0:15–0:30 | Connect via RainbowKit, show Arc Testnet badge, USDC = gas | "USDC is the gas token, the quote token, and the billing currency. No bridges, no native asset volatility, sub-second finality." Mention briefly: "We also integrated Circle Modular Wallets for passkey-secured gasless txns — adapter is in the repo and activates once Circle enables Arc Testnet for our Client Key." |
| 0:30–1:00 | **Demo 0: Small AMM swap**. Type "swap 5 USDC to GOLD". Quote panel shows green "AMM (Pyth-priced)" + small explainer "Routing decision: Trade < $1,000 threshold". Execute. | "Below the RFQ threshold the router skips the maker fan-out and settles instantly against ObscuraAMM, which prices off Pyth. One-click low-latency execution for everyday trade sizes." |
| 1:00–1:30 | **Demo 1: Multi-maker RFQ**. Type "swap 1500 USDC to MSTR" — over the $1k threshold. Quote panel turns purple, shows 3 competing quotes. Execute. | "Above the threshold the router fans out to three makers — Wintermute, Jump, Citadel personas — and picks the best signed quote. Every quote is bounded by Pyth ±2%, so even a compromised maker key can't rug the agent." |
| 1:15–1:45 | **Demo 2: Stablecoin FX**. Type "swap 1 USDC to EURC". Show FxEscrow badge. Click ArcScan link. | "Stablecoin FX pairs are FxEscrow-compatible. We use the same oracle-bounded RFQ pattern Circle's institutional bridge uses." |
| 1:45–2:15 | **Demo 3: Nanopayments**. Show Nanopay badge updating: "$0.0035 across 4 services". Open console, show signed claims piling up. | "Every micro-event the agent does — fetching a quote, parsing a prompt, pushing a Pyth update — is billed via off-chain signed messages. Sub-cent rates, settled on-chain in a single batch when the maker chooses." |
| 2:15–2:45 | **Demo 4: Conditional intent**. Type "buy GOLD with 5 USDC if GOLD drops 1%". Show watcher armed. | "The agent doesn't just react — it watches. Once the Pyth oracle hits the trigger, the agent executes autonomously. Pay-per-watch, pay-per-fire." |
| 2:45–3:15 | Architecture diagram (zoom in on each layer). Briefly highlight that the Modular Wallets adapter ships in this repo even though the live demo runs via RainbowKit. | "Five contracts: Pyth-priced AMM, EIP-712 RFQ with oracle ceiling, programmable privacy Shield, USDC payment channels, plus a Modular Wallets adapter ready to switch on once Circle enables Arc Testnet on our Client Key." |
| 3:15–3:45 | GitHub repo + Vercel URL + closing | "All code at github.com/<your handle>/obscura. Live demo at <vercel url>. 23 hardhat tests, 100% passing. Built for the Stablecoin Commerce Stack Challenge, Track 4. Thank you." |

### Recording tips

- Pre-warm Pyth feeds via `npm run seed:arc` 5 minutes sebelum recording
- Pre-load USDC + GOLD + EURC ke wallet demo supaya tidak nunggu faucet di video
- Buka 2 tabs: dapp + ArcScan, switch antara mereka untuk show on-chain proof
- Kalau RFQ skip ke AMM (random fillRate), record ulang segment itu sampai dapat 3 quotes

---

## Phase 6 — Submission checklist

| Item | Status | Action |
|---|---|---|
| ✅ Functional MVP | DONE | Frontend + 4 contracts, all live |
| ✅ Architecture diagram | DONE | `ARCHITECTURE.md` dengan mermaid |
| ✅ Hardhat tests | DONE | 23/23 passing |
| ✅ README dengan setup docs | DONE | `README.md` |
| ✅ Circle Product Feedback | DONE | Section di README |
| ⚠️ Demo video | TODO | Lihat Phase 5 |
| ⚠️ Demo URL | TODO | Deploy ke Vercel/Netlify |
| ⚠️ Circle Developer Account | USER ACTION | Sign up at https://console.circle.com/signup |
| ⚠️ Submission form | USER ACTION | Submit di hackathon portal |

### Things to mention in submission "what worked / what didn't"

(Already di README "Circle Product Feedback" section, copy paste:)

**What worked**: Arc Testnet sub-second finality, USDC-as-gas predictability, Pyth on Arc easy integration, faucet UX, docs.

**What could improve**: First-class Nanopayments SDK on Arc, Pyth feed warming for niche assets, EURC + USDC combined faucet flow, Modular Wallets quickstart for agent flows.

---

## Phase 7 — Post-submission (optional)

Selama judging window:

- **Monitor Pyth feeds** harian. Kalau feed stale, push manual via `npm run seed:arc`.
- **Cek RFQ events** di ArcScan — pastikan tidak ada kebanjiran tx fail (indikasi maker key issue).
- **Reply to judges' questions** di hackathon Discord cepat.

---

## Yang JANGAN diubah

- `contracts/*.sol` — semua sudah tested 23/23
- `scripts/deploy.cjs` Pyth feed IDs
- EIP-712 domain di `rfqConfig.ts` dan `nanopayConfig.ts` (harus match contract constructor)
- `RFQ_MAKER_ADDRESS` derivation logic di `rfqMaker.ts`
- `src/config/priceFeeds.ts` — Pyth feed IDs (USDC/EURC/JPYC/GOLD/AAPL/MSTR sudah benar)
- `PYTH_INVERTED.JPYC = true` — kalau diubah, JPYC pricing rusak
- `ARC_TESTNET_PATH = 'arcTestnet'` di `src/lib/circleWallet.ts` — Arc Testnet path segment per Circle docs

## Yang BOLEH diubah untuk demo polish

- `src/data/docsContent.ts` — narasi marketing
- `src/pages/Landing.tsx` — copy hero (sudah di-pivot ke "Autonomous Stablecoin Agent")
- `MAKER_POOL` di `src/lib/rfqMaker.ts` — ganti label, jitter, fillRate
- `NANOPAY_RATES` di `src/config/nanopayConfig.ts` — sesuaikan rate per service
- `lanjut.md` — file ini
- `MOCK_PRICES` di `src/lib/priceOracle.ts` — fallback prices kalau Hermes down
- `VITE_RFQ_MIN_USD` di `.env` — threshold trade USD untuk engage RFQ. Default 1000 untuk testnet (mudah demo dengan budget faucet kecil), production 100000.

---

## Reference cepat

```bash
# Compile + test
npm run compile
npm run test:contracts          # 23/23

# Deploy (one-shot, dengan extra makers)
RFQ_EXTRA_MAKERS=0x...,0x... npm run deploy:arc
npm run seed:arc
npm run verify:arc

# Dev / build
npm run dev
npm run build
```

---

Semua siap. Tinggal: re-deploy include Nanopay → record video → deploy ke Vercel → submit.
