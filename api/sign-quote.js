// Vercel Serverless: signs RFQ quotes server-side so private key never reaches client.
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';

const RFQ_EIP712_DOMAIN = { name: 'ObscuraRFQ', version: '1' };
const RFQ_EIP712_TYPES = {
  Quote: [
    { name: 'quoteId', type: 'bytes32' },
    { name: 'maker', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'amountOut', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
};

const MAKER_PROFILES = [
  { label: 'Wintermute', improvementBps: 12, jitterBps: 4, fillRate: 0.95 },
  { label: 'Jump Trading', improvementBps: 8, jitterBps: 5, fillRate: 0.92 },
  { label: 'Citadel Sec.', improvementBps: 6, jitterBps: 6, fillRate: 0.88 },
];

function deriveKey(seed, salt) {
  const hex = seed.slice(2).toLowerCase();
  if (hex.length !== 64) return seed;
  const high = parseInt(hex.slice(0, 4), 16) ^ (salt & 0xffff);
  return ('0x' + high.toString(16).padStart(4, '0') + hex.slice(4));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const MAKER_KEY = process.env.RFQ_MAKER_PRIVATE_KEY;
  if (!MAKER_KEY) return res.status(500).json({ error: 'Server misconfigured' });

  const { taker, tokenIn, tokenOut, amountIn, fairAmountOut, expirySeconds = 30, chainId, verifyingContract } = req.body;
  if (!taker || !tokenIn || !tokenOut || !amountIn || !fairAmountOut) {
    return res.status(400).json({ error: 'Missing params' });
  }

  const expiry = BigInt(Math.floor(Date.now() / 1000) + expirySeconds);
  const domain = { ...RFQ_EIP712_DOMAIN, chainId: Number(chainId), verifyingContract };

  const quotes = [];
  for (let i = 0; i < MAKER_PROFILES.length; i++) {
    const profile = MAKER_PROFILES[i];
    if (Math.random() > profile.fillRate) continue;

    const key = i === 0 ? MAKER_KEY : deriveKey(MAKER_KEY, 0xa11c + i * 0x100);
    const account = privateKeyToAccount(key);

    const jitter = Math.floor((Math.random() - 0.5) * profile.jitterBps);
    const totalBps = profile.improvementBps + jitter;
    const amountOut = (BigInt(fairAmountOut) * BigInt(10000 + totalBps)) / 10000n;

    const salt = BigInt(Date.now()) * 1000000n + BigInt(Math.floor(Math.random() * 1000000)) + BigInt(i);
    const quoteId = keccak256(encodePacked(['address', 'address', 'uint256', 'uint256'], [account.address, taker, BigInt(amountIn), salt]));

    const message = { quoteId, maker: account.address, taker, tokenIn, tokenOut, amountIn: BigInt(amountIn), amountOut, expiry };

    try {
      const signature = await account.signTypedData({ domain, types: RFQ_EIP712_TYPES, primaryType: 'Quote', message });
      quotes.push({
        quoteId, maker: account.address, taker, tokenIn, tokenOut,
        amountIn: amountIn.toString(), amountOut: amountOut.toString(), expiry: expiry.toString(),
        signature, source: 'remote', makerLabel: profile.label, improvementBps: totalBps,
      });
    } catch (e) { /* skip failed signer */ }
  }

  quotes.sort((a, b) => BigInt(b.amountOut) > BigInt(a.amountOut) ? 1 : -1);
  res.status(200).json(quotes);
}
