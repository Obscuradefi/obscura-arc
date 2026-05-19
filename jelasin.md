# Penjelasan Fitur: Agents, Shadow, dan x402

## 1. Agents (Multi-Agent Orchestrator)

**Apa ini?**

Tab Agents mendemonstrasikan bagaimana beberapa AI agent bekerja sama untuk menyelesaikan satu perintah user. Bukan satu agent monolitik, tapi **3 sub-agent** yang masing-masing punya tugas spesifik dan **membayar sendiri** untuk setiap aksi yang dilakukan.

**3 Sub-Agent:**

| Agent | Tugas | Biaya per aksi |
|---|---|---|
| 🔍 **Researcher** | Pantau harga Pyth, deteksi kapan kondisi trigger terpenuhi | $0.0001 USDC per price check |
| 💰 **Executor** | Fan-out ke 3 maker RFQ, pilih quote terbaik, submit settlement | $0.001 USDC per quote request |
| ✅ **Verifier** | Cek receipt transaksi, validasi Pyth deviation, emit proof | $0.0002 USDC per verification |

**Flow:**

```
User: "Buy 50 USDC of GOLD when GOLD drops 0.5%"
  │
  ├── Researcher: poll Pyth setiap 30 detik
  │     → charge $0.0001 per tick
  │     → trigger ketika kondisi terpenuhi
  │
  ├── Executor: fan-out ke Wintermute / Jump / Citadel
  │     → charge $0.001 per quote
  │     → pilih best quote, submit EIP-712 settle
  │
  └── Verifier: baca event log on-chain
        → charge $0.0002 per check
        → emit "verified" proof ke Shadow Activity feed

Total cost: ~$0.005 USDC untuk seluruh orchestration
```

**Kenapa ini penting untuk Track 4 (Agentic Economy)?**

- Menunjukkan **agent-to-agent economy** — setiap sub-agent adalah entitas ekonomi yang dibayar untuk jasanya
- Billing via **ObscuraNanopay** (on-chain USDC payment channel) — bukan mock, tapi signed claims yang bisa di-settle on-chain
- Composable: primitif yang sama (Nanopay + RFQ + Pyth) dipakai di Swap tab, tapi di sini di-orchestrate oleh multiple agents

---

## 2. Shadow (Shadow Activity Feed)

**Apa ini?**

Tab Shadow adalah **real-time event stream** dari semua kontrak Obscura di Arc Testnet. Fitur utamanya: toggle antara **Public lens** dan **Shadow lens** — menunjukkan apa yang terlihat oleh dunia luar vs apa yang sebenarnya terjadi di balik layar.

**Dua mode:**

| Mode | Apa yang ditampilkan | Analogi |
|---|---|---|
| **Public** | Amount, asset symbol, address lengkap | Block explorer biasa (ArcScan) |
| **Shadow** | Commitment hash, address diobfuscate (`0x1a…◇◇◇◇◇`), amount tersembunyi | Apa yang indexer eksternal lihat kalau Obscura pakai confidential transfers |

**Contoh tampilan:**

Public mode:
```
[AMM]     4.50 USDC → 0.001 GOLD
[RFQ]     10.00 USDC → 0.005 MSTR via maker 0xBC0F…
[Shield]  USDC entered vault (level 2)
[Nanopay] 0xBC0F… claimed $0.003 (nonce 7)
```

Shadow mode:
```
[AMM]     0x1a…◇◇◇◇◇ routed ◇◇ → ◇◇
[RFQ]     0x15…◇◇◇◇◇ settled signed quote 0xa7b3c9…
[Shield]  0x15…◇◇◇◇◇ ◇ commitment 0x8f2e1a…
[Nanopay] Channel 0x3d9e4f… released ◇
```

**Statistik real-time:**
- Events streamed (total)
- Volume 1h (public side)
- Per-layer breakdown: AMM swaps / RFQ settled / Vault flows / Nanopay claims

**Kenapa ini penting?**

- Menunjukkan **privacy narrative** Obscura secara visual — juri bisa toggle dan langsung lihat perbedaan
- Mendemonstrasikan bahwa **semua kontrak emit events** yang bisa di-index, tapi dengan Shield + opaque commitments, informasi sensitif tidak bocor
- Real-time (bukan historical) — setiap swap/shield/claim yang terjadi langsung muncul di feed

---

## 3. x402 (Micropayment API)

**Apa ini?**

Tab x402 mendemonstrasikan pattern **HTTP 402 Payment Required** — standar web yang selama ini tidak terpakai, sekarang jadi relevan karena USDC micropayments memungkinkan pay-per-API-call di sub-cent rates.

**Konsep:**

```
Agent: GET /price/GOLD
Server: 402 Payment Required
        X-Payment-Amount: 0.001 USDC
        X-Payment-Recipient: 0xBC0F…
        X-Payment-Settlement: nanopay@0x7Dc0…

Agent: [sign nanopay claim for $0.001]
Agent: GET /price/GOLD
       X-Payment-Claim: <base64-signed-claim>
Server: 200 OK
        { "asset": "GOLD", "price": 4500.12 }
```

**Apa yang terjadi di tab x402:**

1. User klik "Fetch GOLD price"
2. Frontend simulasi 402 handshake (log di console)
3. Nanopay channel di-charge $0.001 USDC (signed off-chain, bisa di-settle on-chain nanti)
4. Harga real dari Pyth Hermes API ditampilkan
5. Counter update: "3 calls billed · $0.003 total"

**Rate:**
- $0.001 USDC per API call (price feed)
- Bisa di-extend ke: per-inference LLM ($0.0005), per-image generation ($0.01), per-data-query ($0.002), dll

**Server demo (bonus):**

File `scripts/x402-demo-server.cjs` adalah HTTP server Node.js yang implement pattern ini over-the-wire:

```bash
node scripts/x402-demo-server.cjs
# GET http://localhost:4242/price/GOLD → 402 + payment headers
# GET http://localhost:4242/price/GOLD + X-Payment-Claim header → 200 + price
```

**Kenapa ini penting untuk Track 4?**

- **Pay-per-inference** adalah literal example dari challenge spec
- Menunjukkan bahwa ObscuraNanopay bukan hanya untuk internal agent billing, tapi bisa jadi **universal micropayment rail** untuk any API
- Pattern 402 sudah ada di HTTP spec sejak 1990-an tapi baru sekarang feasible karena sub-cent stablecoin payments
- Agent economy = agents yang bayar services lain. x402 adalah **interface standard** untuk itu

---

## Bagaimana ketiganya terhubung

```
User intent
  │
  ├── Agents tab: orchestrate 3 sub-agents
  │     ├── Researcher charges via Nanopay (x402 pattern)
  │     ├── Executor charges via Nanopay
  │     └── Verifier charges via Nanopay
  │
  ├── Shadow tab: semua event dari agents muncul real-time
  │     └── Toggle Public/Shadow untuk lihat privacy layer
  │
  └── x402 tab: standalone demo pay-per-call
        └── Same Nanopay channel, same billing primitive
```

Satu primitif (`ObscuraNanopay`) → tiga use case berbeda → satu narasi kohesif: **"The Shadow Layer makes agent-to-agent commerce private, verifiable, and sub-cent."**

---

## Untuk demo video

Urutan recommended:
1. **x402** dulu (paling mudah dipahami: klik → bayar → dapat data)
2. **Agents** (lebih kompleks: 3 sub-agents bekerja sama)
3. **Shadow** (paling visual: toggle lens, lihat feed real-time)

Narasi kunci:
- "Every agent action costs sub-cent USDC, billed through payment channels"
- "The Shadow lens shows what external observers see — opaque commitments, not raw amounts"
- "Three agents, three billing streams, one orchestrated intent"
