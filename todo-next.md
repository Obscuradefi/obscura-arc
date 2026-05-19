# TODO Next: Perubahan yang diminta (session baru)

> Context window penuh. Lanjutkan di session baru dengan file ini sebagai reference.

## Jawaban pertanyaan user

### "Agent cost itu yang ngebiayain siapa?"

Saat ini **mock** — billing di-track di localStorage via `nanopayClient.ts` (signed claims off-chain). Claim bisa di-settle on-chain ke `ObscuraNanopay.sol` kapan saja oleh payee. Tapi **tidak ada yang benar-benar bayar** kecuali user buka channel + deposit USDC ke kontrak Nanopay. Untuk demo hackathon ini cukup — tunjukkan counter naik + signed claims di console. Settlement on-chain opsional.

### "x402 juga begitu?"

Sama — x402 tab charge Nanopay channel off-chain. Server `scripts/x402-demo-server.cjs` adalah contoh HTTP over-the-wire yang validate claim header. Untuk demo, semua client-side.

### "Arc x402 source?"

Arc docs tidak punya x402 spesifik. Kita implement sendiri pattern HTTP 402 + Nanopay. Itu differentiator kita.

### "Register AI Agent (ERC-8004)"

Arc punya ERC-8004 contracts:
- IdentityRegistry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- ReputationRegistry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- ValidationRegistry: `0x8004Cb1BF31DAf7788923b405b754f57acEB4272`

Bisa register Obscura agent on-chain sebagai ERC-8004 identity. Ini bonus differentiator.

---

## Task list (prioritas urut)

### 1. Hapus tab Shadow + x402 + Agents dari navigation

Pindahkan:
- Shadow → merge ke Portfolio (activity log section)
- x402 → hapus tab, jadikan bagian dari AI Agent chat (agent otomatis charge per call)
- Agents → hapus tab terpisah, jadikan bagian dari AI Agent floating button (pojok kanan bawah)

### 2. Upgrade AI Agent (floating button pojok kanan bawah)

Tambah kemampuan:
- **Market insight**: kalau user ketik bukan perintah (misal "analisa market GOLD"), LLM kasih reasoning singkat berdasarkan harga Pyth saat ini
- **Conditional intents yang lebih kaya**: bukan cuma swap, tapi shield, add liquidity, dll
- **Multi-agent orchestration**: saat run, tampilkan live stream panel di sebelah chat (bukan tab terpisah)
- **x402 billing**: setiap LLM call + price fetch di-charge via Nanopay, tampilkan counter di chat

### 3. Liquidity tab: single smart button

Sama seperti Shield fix:
- Approve Asset → (setelah confirm) → Approve USDC → (setelah confirm) → Add Liquidity
- Satu tombol yang auto-detect step mana yang perlu
- Tampilkan balance ready (seperti Swap tab)

### 4. Shield countdown format

- Kalau > 1 jam: tampilkan `23h 14m`
- Kalau < 1 jam: tampilkan `59m 32s`
- Harus live countdown (useEffect interval 1 detik)

### 5. Shield warna ganti

- LOW: orange `#FF8C42`
- MEDIUM: cyan `#22D3EE`
- HIGH: hijau `#4ADE80`

### 6. Markets harga real dari Pyth

Markets tab sudah fetch dari Pyth Hermes via `useMultiplePriceFeeds`. Tapi fallback ke mock kalau Hermes gagal. Pastikan:
- Harga yang tampil = real Pyth (bukan mock)
- Format decimal dinamis (sudah di-fix sebelumnya)

### 7. Token icons

User sudah tambah icon di `/public/assets/` untuk semua pair. Replace semua tempat yang render token (Portfolio, Swap, Markets, Shield, Liquidity) supaya pakai icon dari `/assets/<symbol>.png` atau `.svg`.

Cek folder `public/assets/` untuk list file yang tersedia.

### 8. Routing: semua tab di bawah /app

Pastikan:
- `/app` = main app page dengan tabs
- `/app?tab=swap`, `/app?tab=portfolio`, dll
- Landing page tetap di `/`
- Tidak ada route `/shadow`, `/x402`, `/agents` terpisah

### 9. ERC-8004 Agent Registration (bonus)

Script `scripts/register-agent.cjs`:
- Register Obscura agent di IdentityRegistry
- Record reputation di ReputationRegistry
- Bisa di-run sekali oleh deployer
- Tampilkan agent ID di UI (badge "Registered Agent #X")

### 10. Privy wallet detection

Pastikan `detected_wallets` di Privy config benar-benar scan semua EIP-6963 providers. Kalau Rabby masih tidak muncul, tambahkan explicit `'rabby_wallet'` di walletList (sudah dilakukan, verify saja).

---

## File yang perlu diubah

```
src/components/AppTabs.tsx          — hapus shadow/x402/agents tabs
src/pages/AppPage.tsx               — hapus import + case untuk 3 tab itu
src/features/swap/SwapAgent.tsx     — upgrade: market insight + multi-agent inline + x402 billing
src/features/liquidity/LiquidityTab.tsx — single smart button + show balance
src/features/shield/ShieldTab.tsx   — countdown format + warna baru
src/config/shieldConfig.ts          — warna LOW=orange, MED=cyan, HIGH=green
src/features/markets/MarketsTab.tsx — pastikan real Pyth price
src/features/portfolio/PortfolioTab.tsx — merge Shadow activity feed
src/data/fluxAssets.ts              — tambah icon path per asset
src/components/TokenIcon.tsx        — NEW: reusable token icon component
scripts/register-agent.cjs         — NEW: ERC-8004 registration
```

---

## Instruksi untuk session baru

1. Baca file ini
2. Cek `public/assets/` untuk icon files yang tersedia
3. Mulai dari task #1 (hapus tabs) → #2 (upgrade agent) → #3 (liquidity) → dst
4. Build + push setelah setiap 2-3 task selesai
5. Jangan lupa: `.npmrc` sudah ada dengan `legacy-peer-deps=true`
