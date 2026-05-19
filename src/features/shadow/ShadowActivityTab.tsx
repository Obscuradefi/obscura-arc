import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWatchContractEvent, usePublicClient } from 'wagmi';
import { formatUnits, keccak256, toHex } from 'viem';
import { OBSCURA_AMM_ABI } from '../../config/dexConfig';
import { OBSCURA_RFQ_ABI } from '../../config/rfqConfig';
import { OBSCURA_NANOPAY_ABI } from '../../config/nanopayConfig';
import { SHIELD_ABI } from '../../config/shieldConfig';
import {
    OBSCURA_AMM_ADDRESS,
    OBSCURA_RFQ_ADDRESS,
    OBSCURA_NANOPAY_ADDRESS,
    OBSCURA_SHIELD_ADDRESS,
    arcTxUrl,
} from '../../config/arc';
import { FLUX_ASSETS } from '../../data/fluxAssets';

/** Single normalized record we display in the feed. */
interface ShadowEvent {
    /** Stable ID for de-dup. */
    id: string;
    timestamp: number;
    txHash: string;
    /** Source contract. */
    layer: 'AMM' | 'RFQ' | 'Shield' | 'Nanopay';
    /** Public-mode summary line. */
    publicLine: string;
    /** Shadow-mode obscured line. */
    shadowLine: string;
    /** Optional commitment hash to display in shadow mode. */
    commitment?: string;
    /** Approximate USD volume for the rolling stat (0 when unknown). */
    usd: number;
}

const FEED_MAX = 30;

function symbolFor(addr: string | undefined): string {
    if (!addr) return '?';
    return (
        FLUX_ASSETS.find(
            (a) => a.contractAddress?.toLowerCase() === addr.toLowerCase()
        )?.symbol ?? `0x${addr.slice(2, 6)}…`
    );
}

function decimalsFor(addr: string | undefined): number {
    return (
        FLUX_ASSETS.find(
            (a) => a.contractAddress?.toLowerCase() === addr?.toLowerCase()
        )?.decimals ?? 18
    );
}

function obscure(addr: string | undefined): string {
    if (!addr) return 'addr ◇';
    return `0x${addr.slice(2, 4)}…◇◇◇◇◇`;
}

function commitFromArgs(args: any[]): string {
    return keccak256(toHex(JSON.stringify(args))).slice(0, 18) + '…';
}

/**
 * Real-time event stream from every Obscura contract on Arc Testnet.
 *
 * Two render modes:
 *   - **Public**: humans-readable amount/asset summary (good for portfolio).
 *   - **Shadow**: opaque commitment + obscured addresses (good for showing
 *     what an external indexer would see if Obscura's flows were settled
 *     under a confidential transfer primitive).
 *
 * No backend. We watch contract events directly via viem + cap to FEED_MAX
 * latest items in memory.
 */
const ShadowActivityTab: React.FC = () => {
    const [events, setEvents] = useState<ShadowEvent[]>([]);
    const [shadowMode, setShadowMode] = useState(true);
    const publicClient = usePublicClient();

    const ammDeployed =
        OBSCURA_AMM_ADDRESS &&
        OBSCURA_AMM_ADDRESS !== '0x0000000000000000000000000000000000000000';
    const rfqDeployed =
        OBSCURA_RFQ_ADDRESS &&
        OBSCURA_RFQ_ADDRESS !== '0x0000000000000000000000000000000000000000';
    const shieldDeployed =
        OBSCURA_SHIELD_ADDRESS &&
        OBSCURA_SHIELD_ADDRESS !== '0x0000000000000000000000000000000000000000';
    const nanopayDeployed =
        OBSCURA_NANOPAY_ADDRESS &&
        OBSCURA_NANOPAY_ADDRESS !== '0x0000000000000000000000000000000000000000';

    const push = (ev: ShadowEvent) =>
        setEvents((prev) => {
            if (prev.some((p) => p.id === ev.id)) return prev;
            return [ev, ...prev].slice(0, FEED_MAX);
        });

    useWatchContractEvent({
        address: OBSCURA_AMM_ADDRESS,
        abi: OBSCURA_AMM_ABI,
        eventName: 'Swap',
        enabled: !!ammDeployed,
        onLogs(logs) {
            logs.forEach((log) => {
                const a = log.args as any;
                const amountIn = parseFloat(formatUnits(a.amountIn as bigint, decimalsFor(a.tokenIn as string)));
                const amountOut = parseFloat(formatUnits(a.amountOut as bigint, decimalsFor(a.tokenOut as string)));
                push({
                    id: `${log.transactionHash}:swap`,
                    timestamp: Date.now(),
                    txHash: log.transactionHash || '',
                    layer: 'AMM',
                    publicLine: `${amountIn.toFixed(4)} ${symbolFor(a.tokenIn)} → ${amountOut.toFixed(4)} ${symbolFor(a.tokenOut)}`,
                    shadowLine: `${obscure(a.user)} routed ◇◇ → ◇◇`,
                    commitment: commitFromArgs([a.user, a.tokenIn, a.tokenOut, a.amountIn?.toString()]),
                    usd: amountIn, // rough proxy assuming USDC base
                });
            });
        },
    } as any);

    useWatchContractEvent({
        address: OBSCURA_RFQ_ADDRESS,
        abi: OBSCURA_RFQ_ABI,
        eventName: 'Settled',
        enabled: !!rfqDeployed,
        onLogs(logs) {
            logs.forEach((log) => {
                const a = log.args as any;
                const amountIn = parseFloat(formatUnits(a.amountIn as bigint, decimalsFor(a.tokenIn as string)));
                const amountOut = parseFloat(formatUnits(a.amountOut as bigint, decimalsFor(a.tokenOut as string)));
                push({
                    id: `${log.transactionHash}:rfq`,
                    timestamp: Date.now(),
                    txHash: log.transactionHash || '',
                    layer: 'RFQ',
                    publicLine: `${amountIn.toFixed(4)} ${symbolFor(a.tokenIn)} → ${amountOut.toFixed(4)} ${symbolFor(a.tokenOut)} via maker ${obscure(a.maker)}`,
                    shadowLine: `${obscure(a.taker)} settled signed quote ${(a.quoteId as string)?.slice(0, 10)}…`,
                    commitment: a.quoteId as string,
                    usd: amountIn,
                });
            });
        },
    } as any);

    useWatchContractEvent({
        address: OBSCURA_SHIELD_ADDRESS,
        abi: SHIELD_ABI,
        eventName: 'Shielded',
        enabled: !!shieldDeployed,
        onLogs(logs) {
            logs.forEach((log) => {
                const a = log.args as any;
                push({
                    id: `${log.transactionHash}:shielded`,
                    timestamp: Date.now(),
                    txHash: log.transactionHash || '',
                    layer: 'Shield',
                    publicLine: `${symbolFor(a.asset)} entered vault (level ${Number(a.level ?? 0)})`,
                    shadowLine: `${obscure(a.user)} ◇ commitment ${(a.commitment as string)?.slice(0, 10)}…`,
                    commitment: a.commitment as string,
                    usd: 0,
                });
            });
        },
    } as any);

    useWatchContractEvent({
        address: OBSCURA_SHIELD_ADDRESS,
        abi: SHIELD_ABI,
        eventName: 'Unshielded',
        enabled: !!shieldDeployed,
        onLogs(logs) {
            logs.forEach((log) => {
                const a = log.args as any;
                push({
                    id: `${log.transactionHash}:unshielded`,
                    timestamp: Date.now(),
                    txHash: log.transactionHash || '',
                    layer: 'Shield',
                    publicLine: `${symbolFor(a.asset)} left vault`,
                    shadowLine: `${obscure(a.user)} ◇ commitment ${(a.commitment as string)?.slice(0, 10)}…`,
                    commitment: a.commitment as string,
                    usd: 0,
                });
            });
        },
    } as any);

    useWatchContractEvent({
        address: OBSCURA_NANOPAY_ADDRESS,
        abi: OBSCURA_NANOPAY_ABI,
        eventName: 'ChannelClaim',
        enabled: !!nanopayDeployed,
        onLogs(logs) {
            logs.forEach((log) => {
                const a = log.args as any;
                const inc = parseFloat(formatUnits(a.increment as bigint, 6));
                push({
                    id: `${log.transactionHash}:claim:${a.nonce}`,
                    timestamp: Date.now(),
                    txHash: log.transactionHash || '',
                    layer: 'Nanopay',
                    publicLine: `${obscure(a.payee)} claimed $${inc.toFixed(4)} (nonce ${a.nonce})`,
                    shadowLine: `Channel ${(a.channelId as string)?.slice(0, 10)}… released ◇`,
                    commitment: a.channelId as string,
                    usd: inc,
                });
            });
        },
    } as any);

    // Synthetic local events from in-app actions (e.g. agent-initiated trades
    // before the on-chain event is mined). We poll the activity log every
    // 2 seconds so the feed reacts instantly, while real on-chain events
    // augment it as they arrive.
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as ShadowEvent;
            push(detail);
        };
        window.addEventListener('obscura:shadow:event', handler);
        return () => window.removeEventListener('obscura:shadow:event', handler);
    }, []);

    const totalUsdLastHour = useMemo(() => {
        const cutoff = Date.now() - 60 * 60 * 1000;
        return events.filter((e) => e.timestamp >= cutoff).reduce((s, e) => s + e.usd, 0);
    }, [events]);

    const layerCounts = useMemo(() => {
        const counts: Record<string, number> = { AMM: 0, RFQ: 0, Shield: 0, Nanopay: 0 };
        events.forEach((e) => {
            counts[e.layer] = (counts[e.layer] ?? 0) + 1;
        });
        return counts;
    }, [events]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}
        >
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#F0F0F0', margin: '0 0 4px' }}>
                        Shadow Activity
                    </h2>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Live event stream · AMM · RFQ · Vault · Nanopay
                    </div>
                </div>

                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        background: 'rgba(167,139,250,0.06)',
                        border: '1px solid rgba(167,139,250,0.25)',
                        borderRadius: 999,
                    }}
                >
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '0 8px', letterSpacing: '0.05em' }}>
                        VIEW
                    </span>
                    {[
                        { key: false, label: 'Public' },
                        { key: true, label: 'Shadow' },
                    ].map((m) => (
                        <button
                            key={String(m.key)}
                            onClick={() => setShadowMode(m.key)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: 999,
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                border: 'none',
                                background: shadowMode === m.key ? 'rgba(167,139,250,0.18)' : 'transparent',
                                color: shadowMode === m.key ? '#A78BFA' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* stat row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {[
                    {
                        label: 'Events streamed',
                        value: events.length.toString(),
                        color: 'var(--green-300)',
                    },
                    {
                        label: 'Volume (1h, public side)',
                        value: `$${totalUsdLastHour.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                        color: '#F0F0F0',
                    },
                    {
                        label: 'AMM swaps',
                        value: layerCounts.AMM.toString(),
                        color: 'var(--green-400)',
                    },
                    {
                        label: 'RFQ settled',
                        value: layerCounts.RFQ.toString(),
                        color: 'var(--neon-purple)',
                    },
                    {
                        label: 'Vault flows',
                        value: layerCounts.Shield.toString(),
                        color: '#5FBFFF',
                    },
                    {
                        label: 'Nanopay claims',
                        value: layerCounts.Nanopay.toString(),
                        color: '#FFC454',
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
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                            {s.label}
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', color: s.color }}>
                            {s.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* mode banner */}
            <div
                style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: shadowMode ? 'rgba(167,139,250,0.06)' : 'rgba(61,158,78,0.06)',
                    border: `1px solid ${shadowMode ? 'rgba(167,139,250,0.25)' : 'rgba(61,158,78,0.25)'}`,
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                }}
            >
                <strong style={{ color: shadowMode ? '#A78BFA' : 'var(--green-300)' }}>
                    {shadowMode ? 'Shadow lens' : 'Public lens'}:
                </strong>{' '}
                {shadowMode
                    ? 'Addresses obscured to first 4 hex; amounts hidden behind ◇; commitment hashes surfaced. This is what an external indexer sees if Obscura\'s flows were under a confidential transfer primitive.'
                    : 'Plain-text addresses, asset symbols, and amounts. Treat as the everyday DeFi explorer view — useful for accounting and portfolio tracking.'}
            </div>

            {/* feed */}
            {events.length === 0 ? (
                <div
                    style={{
                        padding: '40px',
                        textAlign: 'center',
                        background: 'rgba(13,13,18,0.7)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 14,
                    }}
                >
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-dim)', marginBottom: 8 }}>
                        Waiting for the next on-chain event…
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                        Open Swap, Vault, or run an Agent intent to see entries appear here in real time.
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <AnimatePresence initial={false}>
                        {events.map((e) => (
                            <motion.div
                                key={e.id}
                                layout
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 16 }}
                                transition={{ duration: 0.25 }}
                                style={{
                                    padding: '14px 18px',
                                    background: 'rgba(13,13,18,0.85)',
                                    border: `1px solid ${shadowMode ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.07)'}`,
                                    borderRadius: 12,
                                    display: 'grid',
                                    gridTemplateColumns: '90px 1fr auto',
                                    alignItems: 'center',
                                    gap: 12,
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            display: 'inline-block',
                                            padding: '3px 8px',
                                            borderRadius: 5,
                                            background: layerColor(e.layer).bg,
                                            color: layerColor(e.layer).fg,
                                            fontSize: '0.62rem',
                                            fontWeight: 800,
                                            letterSpacing: '0.06em',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        {e.layer}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.86rem', color: '#F0F0F0', marginBottom: 4 }}>
                                        {shadowMode ? e.shadowLine : e.publicLine}
                                    </div>
                                    {shadowMode && e.commitment && (
                                        <div
                                            style={{
                                                fontSize: '0.7rem',
                                                color: 'var(--text-dim)',
                                                fontFamily: 'JetBrains Mono, monospace',
                                            }}
                                        >
                                            commitment {e.commitment.length > 14 ? e.commitment.slice(0, 14) + '…' : e.commitment}
                                        </div>
                                    )}
                                </div>
                                <a
                                    href={arcTxUrl(e.txHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--green-300)',
                                        textDecoration: 'none',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    View on ArcScan ↗
                                </a>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
};

function layerColor(layer: string): { bg: string; fg: string } {
    switch (layer) {
        case 'AMM':
            return { bg: 'rgba(61,158,78,0.15)', fg: 'var(--green-300)' };
        case 'RFQ':
            return { bg: 'rgba(167,139,250,0.18)', fg: '#A78BFA' };
        case 'Shield':
            return { bg: 'rgba(95,191,255,0.15)', fg: '#5FBFFF' };
        case 'Nanopay':
            return { bg: 'rgba(255,196,84,0.15)', fg: '#FFC454' };
        default:
            return { bg: 'rgba(255,255,255,0.05)', fg: 'var(--text-secondary)' };
    }
}

export default ShadowActivityTab;
