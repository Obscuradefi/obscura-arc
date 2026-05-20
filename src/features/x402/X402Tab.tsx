import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { useEffectiveAccount } from '../../hooks/useEffectiveAccount';
import {
    chargeService,
    isNanopayConfigured,
    deriveChannelId,
} from '../../lib/nanopayClient';
import { RFQ_MAKER_ADDRESS } from '../../config/arc';
import { fetchAssetPrice } from '../../lib/priceOracle';

/**
 * Demo of an HTTP-style "402 Payment Required" pattern, implemented entirely
 * in the browser so the dapp doesn't need a backend. Three things happen:
 *
 *   1. User clicks "Fetch GOLD price" → frontend sends a synthetic GET that
 *      "fails" with a 402 + payment header.
 *   2. Frontend signs a Nanopay claim for 0.001 USDC against the configured
 *      maker payee (same one ObscuraRFQ uses), bumping the running total.
 *   3. Frontend retries the call carrying the signed claim, then fetches the
 *      Pyth price (real Hermes API) and renders the result.
 *
 * Real production wiring would do steps 1+3 over the wire, but the UX and
 * pricing semantics are identical. The point is to demonstrate the "agent
 * pays per API call at sub-cent rates" narrative with a real on-chain
 * channel doing the accounting.
 */

interface CallRecord {
    timestamp: number;
    asset: string;
    price: number;
    nonce: bigint;
    totalSpent: bigint;
}

const X402Tab: React.FC = () => {
    const { address, isConnected, source } = useEffectiveAccount();
    const [history, setHistory] = useState<CallRecord[]>([]);
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const RATE_PER_CALL = 1_000n; // 0.001 USDC, mirrors NANOPAY_RATES.RFQ_QUOTE_RATE
    const SERVICE_KEY = 'x402:price-feed';

    const supportedAssets = ['GOLD', 'AAPL', 'MSTR', 'EURC', 'JPYC'];

    const callX402 = async (asset: string) => {
        setError(null);
        setLoading(asset);

        if (!address) {
            setError('Connect a wallet first to enable x402 micropayments.');
            setLoading(null);
            return;
        }
        if (!isNanopayConfigured()) {
            setError('Nanopay channel not configured. The agent cannot bill itself.');
            setLoading(null);
            return;
        }
        if (RFQ_MAKER_ADDRESS === '0x0000000000000000000000000000000000000000') {
            setError('Service payee address not deployed yet. Run npm run deploy:arc.');
            setLoading(null);
            return;
        }

        try {
            // Step 1: simulate "402 Payment Required" handshake. In a real
            // server-client flow this would arrive as a header; here we just
            // construct it client-side to keep the demo fully self-contained.
            console.log(`[x402] GET /price/${asset} -> 402 Payment Required`, {
                price: `${formatUnits(RATE_PER_CALL, 6)} USDC`,
                payTo: RFQ_MAKER_ADDRESS,
                channel: deriveChannelId(address, RFQ_MAKER_ADDRESS as `0x${string}`).channelId,
            });

            // Step 2: sign a nanopay claim against the maker channel.
            const claim = await chargeService(
                address,
                RFQ_MAKER_ADDRESS as `0x${string}`,
                SERVICE_KEY,
                RATE_PER_CALL
            );
            if (!claim) {
                throw new Error('Failed to sign nanopay claim');
            }
            console.log('[x402] payment claim signed', {
                channelId: claim.channelId,
                totalSpent: claim.totalSpent.toString(),
                nonce: claim.nonce.toString(),
            });

            // Step 3: call the actual oracle API. The signed claim header
            // would normally be attached as `X-Payment-Claim` on the retry.
            const price = await fetchAssetPrice(asset);

            setHistory((h) =>
                [
                    {
                        timestamp: Date.now(),
                        asset,
                        price,
                        nonce: claim.nonce,
                        totalSpent: claim.totalSpent,
                    },
                    ...h,
                ].slice(0, 12)
            );
        } catch (e: any) {
            console.error('[x402]', e);
            setError(e?.message ?? 'x402 call failed');
        } finally {
            setLoading(null);
        }
    };

    const totalSpent = history[0]?.totalSpent ?? 0n;
    const callCount = history.length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}
        >
            <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#F0F0F0', margin: '0 0 4px' }}>
                    x402 Micropayment API
                </h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Pay-per-call price feed · 0.001 USDC each · settled via Nanopay channels
                </div>
            </div>

            {/* explainer */}
            <div
                style={{
                    padding: '16px 20px',
                    background: 'rgba(255,196,84,0.05)',
                    border: '1px solid rgba(255,196,84,0.25)',
                    borderRadius: 12,
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.65,
                }}
            >
                <strong style={{ color: '#FFC454' }}>How this works:</strong>{' '}
                Each click simulates an HTTP GET that the server answers with{' '}
                <code style={{ color: '#FFC454' }}>402 Payment Required</code>. The
                browser signs a sub-cent USDC claim against an open nanopay channel,
                attaches it to the retry, and the price comes back from Pyth Hermes.
                Real production setup uses the same shape but over the wire — see{' '}
                <code style={{ color: '#FFC454' }}>scripts/x402-demo-server.cjs</code>{' '}
                for a worked HTTP example.
            </div>

            {/* counters */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 12,
                }}
            >
                {[
                    {
                        label: 'Calls billed',
                        value: callCount.toString(),
                        color: '#FFC454',
                    },
                    {
                        label: 'Channel total',
                        value: `$${parseFloat(formatUnits(totalSpent, 6)).toFixed(4)}`,
                        color: '#F0F0F0',
                    },
                    {
                        label: 'Rate per call',
                        value: `$${parseFloat(formatUnits(RATE_PER_CALL, 6)).toFixed(4)}`,
                        color: 'var(--green-300)',
                    },
                    {
                        label: 'Wallet path',
                        value: source ? source.toUpperCase() : 'NONE',
                        color: source === 'circle' ? '#5FBFFF' : 'var(--green-300)',
                    },
                ].map((s) => (
                    <div
                        key={s.label}
                        style={{
                            padding: '14px 16px',
                            background: 'rgba(13,13,18,0.85)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 12,
                        }}
                    >
                        <div
                            style={{
                                fontSize: '0.62rem',
                                color: 'var(--text-dim)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                marginBottom: 6,
                            }}
                        >
                            {s.label}
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', color: s.color }}>
                            {s.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* asset buttons */}
            <div
                style={{
                    background: 'rgba(13,13,18,0.85)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 14,
                    padding: 20,
                }}
            >
                <div
                    style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-dim)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 12,
                    }}
                >
                    Pay & fetch a price
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {supportedAssets.map((asset) => (
                        <button
                            key={asset}
                            onClick={() => callX402(asset)}
                            disabled={!isConnected || loading !== null}
                            style={{
                                padding: '10px 18px',
                                borderRadius: 10,
                                background:
                                    loading === asset
                                        ? 'rgba(255,196,84,0.15)'
                                        : 'rgba(167,139,250,0.08)',
                                border: '1px solid rgba(167,139,250,0.3)',
                                color: '#A78BFA',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                cursor: !isConnected || loading !== null ? 'not-allowed' : 'pointer',
                                opacity: !isConnected || loading !== null ? 0.6 : 1,
                                transition: 'all 0.2s',
                            }}
                        >
                            {loading === asset ? `Paying for ${asset}…` : `Fetch ${asset} price`}
                        </button>
                    ))}
                </div>

                {error && (
                    <div
                        style={{
                            marginTop: 12,
                            padding: '8px 12px',
                            background: 'rgba(255,85,119,0.08)',
                            border: '1px solid rgba(255,85,119,0.25)',
                            borderRadius: 8,
                            color: '#FFB0BD',
                            fontSize: '0.78rem',
                        }}
                    >
                        {error}
                    </div>
                )}
            </div>

            {/* history */}
            {history.length > 0 && (
                <div
                    style={{
                        background: 'rgba(13,13,18,0.85)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 14,
                        padding: '20px 24px',
                    }}
                >
                    <div
                        style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-dim)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            marginBottom: 14,
                        }}
                    >
                        Call history
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {history.map((h, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '70px 1fr auto auto',
                                    gap: 12,
                                    padding: '10px 12px',
                                    background: 'rgba(255,255,255,0.025)',
                                    borderRadius: 8,
                                    alignItems: 'center',
                                    fontSize: '0.84rem',
                                }}
                            >
                                <span
                                    style={{
                                        padding: '3px 8px',
                                        borderRadius: 5,
                                        background: 'rgba(167,139,250,0.18)',
                                        color: '#A78BFA',
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        textAlign: 'center',
                                    }}
                                >
                                    {h.asset}
                                </span>
                                <span style={{ color: '#F0F0F0' }}>${h.price.toFixed(4)}</span>
                                <span style={{ color: 'var(--text-dim)', fontSize: '0.74rem' }}>
                                    nonce {h.nonce.toString()}
                                </span>
                                <span
                                    style={{
                                        color: '#FFC454',
                                        fontSize: '0.78rem',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }}
                                >
                                    +${parseFloat(formatUnits(RATE_PER_CALL, 6)).toFixed(4)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default X402Tab;
