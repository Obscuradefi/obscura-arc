/* eslint-disable no-console */
/**
 * Standalone x402 demo server.
 *
 * Run with `node scripts/x402-demo-server.cjs` (no extra deps — uses node:http).
 * Exposes:
 *
 *   GET  /price/:asset
 *     - First call returns 402 Payment Required with payment instructions
 *       in the X-Payment-Required header.
 *     - Second call (with X-Payment-Claim header carrying a signed
 *       ObscuraNanopay claim) returns the real Pyth price from Hermes.
 *
 *   GET  /health
 *     - Returns `{ ok: true }` for sanity.
 *
 *   POST /claim
 *     - Lets a payee submit accumulated claims on-chain. Stub here for
 *       demonstration; real production would wire a signer + send to
 *       ObscuraNanopay.claim() in batches.
 *
 * The browser version of this flow lives in `src/features/x402/X402Tab.tsx`
 * — that file does the same thing client-side without needing this server.
 * We ship this script as the "real over-the-wire example" to show what an
 * agent-paying-for-API consumption looks like end-to-end.
 */

const http = require('node:http');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 4242);
const HERMES = 'https://hermes.pyth.network';

// Same Pyth feed IDs the dapp uses. Keep in sync with src/config/priceFeeds.ts.
const PYTH_FEEDS = {
    USDC: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    EURC: '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
    JPYC: '0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52',
    GOLD: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
    AAPL: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
    MSTR: '0xe1e80251e5f5184f2195008382538e847fafc36f751896889dd3d1b1f6111f09',
};

// Inverted feeds (USD/JPY -> JPY/USD). Mirrors PYTH_INVERTED in priceFeeds.ts.
const INVERTED = new Set(['JPYC']);

// Per-call price in raw USDC units (6 decimals). 1000 = $0.001.
const RATE_PER_CALL = 1000n;

// Where the agent should send payments. Replace with the deployer/maker
// address that is registered as a payee in ObscuraNanopay (defaults to the
// RFQ maker since we already know that one is whitelisted on-chain).
const PAYEE_ADDRESS =
    process.env.NANOPAY_PAYEE ||
    '0xBC0F85275613FAcB31773b5D8b44C803cdeCa06e';

const NANOPAY_CONTRACT =
    process.env.NANOPAY_CONTRACT ||
    '0x7Dc039156A64B3dC461C85dab362f997Dd8E4Cf1';

// In-memory tally per channel; production would persist to Redis/DB.
const channelTotals = new Map();

function send(res, status, headers, body) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-Payment-Claim, Content-Type',
        ...headers,
    });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function fetchPythPrice(asset) {
    const id = PYTH_FEEDS[asset];
    if (!id) throw new Error(`Unknown asset: ${asset}`);
    const res = await fetch(`${HERMES}/v2/updates/price/latest?ids[]=${id}`);
    if (!res.ok) throw new Error(`Hermes ${res.status}`);
    const data = await res.json();
    const p = data?.parsed?.[0]?.price;
    if (!p) throw new Error('Hermes: empty');
    const raw = Number(p.price) * Math.pow(10, p.expo);
    return INVERTED.has(asset) ? 1 / raw : raw;
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        send(res, 200, {}, '');
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // ---------- /health ----------
    if (req.method === 'GET' && url.pathname === '/health') {
        send(res, 200, {}, { ok: true });
        return;
    }

    // ---------- /price/:asset ----------
    const priceMatch = url.pathname.match(/^\/price\/([A-Za-z]+)$/);
    if (req.method === 'GET' && priceMatch) {
        const asset = priceMatch[1].toUpperCase();
        if (!PYTH_FEEDS[asset]) {
            send(res, 404, {}, { error: `Unknown asset ${asset}` });
            return;
        }

        const claimHeader = req.headers['x-payment-claim'];
        if (!claimHeader) {
            // First touch -> 402 Payment Required.
            send(
                res,
                402,
                {
                    'X-Payment-Required': `1`,
                    'X-Payment-Token': 'USDC',
                    'X-Payment-Amount': RATE_PER_CALL.toString(),
                    'X-Payment-Recipient': PAYEE_ADDRESS,
                    'X-Payment-Settlement': `nanopay@${NANOPAY_CONTRACT}`,
                },
                {
                    error: 'payment_required',
                    rate_raw_usdc: RATE_PER_CALL.toString(),
                    payee: PAYEE_ADDRESS,
                    settlement: {
                        type: 'obscura-nanopay',
                        contract: NANOPAY_CONTRACT,
                    },
                    instructions:
                        'Sign a Nanopay claim against the channel between your wallet and `payee` for at least the `rate_raw_usdc` amount, then retry with X-Payment-Claim: <base64-json>.',
                }
            );
            return;
        }

        // Decode claim header. We accept JSON-stringified Nanopay claim.
        // Production would also recover + verify the signature on-chain.
        let claim;
        try {
            const raw = Buffer.from(claimHeader, 'base64').toString('utf8');
            claim = JSON.parse(raw);
        } catch {
            send(res, 400, {}, { error: 'invalid_claim_header' });
            return;
        }

        if (!claim.channelId || !claim.totalSpent || !claim.signature) {
            send(res, 400, {}, { error: 'incomplete_claim' });
            return;
        }

        const last = channelTotals.get(claim.channelId) ?? 0n;
        const total = BigInt(claim.totalSpent);
        if (total - last < RATE_PER_CALL) {
            send(res, 402, {}, {
                error: 'insufficient_increment',
                hint: `Increment ${(total - last).toString()} < required ${RATE_PER_CALL.toString()}`,
            });
            return;
        }
        channelTotals.set(claim.channelId, total);

        try {
            const price = await fetchPythPrice(asset);
            console.log(
                `[x402] ${asset} served, channel=${claim.channelId.slice(0, 10)}…, ` +
                    `total=${total.toString()}, price=${price}`
            );
            send(
                res,
                200,
                { 'X-Payment-Accepted': total.toString() },
                {
                    asset,
                    price,
                    paid_raw_usdc: RATE_PER_CALL.toString(),
                    channel_total: total.toString(),
                }
            );
        } catch (e) {
            send(res, 502, {}, { error: 'hermes_unavailable', detail: String(e?.message ?? e) });
        }
        return;
    }

    // ---------- /claim ----------
    if (req.method === 'POST' && url.pathname === '/claim') {
        // Stub. A real settlement service would batch the latest claim
        // signatures and submit them to ObscuraNanopay.claim() on-chain.
        send(res, 200, {}, {
            ok: true,
            note: 'Stub. Wire to ObscuraNanopay.claim() with a backend signer for production.',
        });
        return;
    }

    send(res, 404, {}, { error: 'not_found' });
});

server.listen(PORT, () => {
    console.log(`x402 demo server listening on http://localhost:${PORT}`);
    console.log(`  GET  /health`);
    console.log(`  GET  /price/:asset           (start with this to see the 402 handshake)`);
    console.log(`  POST /claim                  (stub for batch settlement)`);
    console.log(`  payee   : ${PAYEE_ADDRESS}`);
    console.log(`  contract: ${NANOPAY_CONTRACT}`);
});
