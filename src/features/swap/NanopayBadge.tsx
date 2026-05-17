import React, { useEffect, useState } from 'react';
import { useEffectiveAccount } from '../../hooks/useEffectiveAccount';
import { formatUnits } from 'viem';
import {
    getChannelSnapshot,
    isNanopayConfigured,
} from '../../lib/nanopayClient';
import { RFQ_MAKER_ADDRESS } from '../../config/arc';

/**
 * Live counter showing how much the user (acting as a payer) has accumulated
 * in their Nanopay channel against the default RFQ maker. Polls localStorage
 * every 1.5s so updates from `chargeService` reflect immediately.
 *
 * Renders nothing if Nanopay isn't configured.
 */
const NanopayBadge: React.FC = () => {
    const { address } = useEffectiveAccount();
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setTick((n) => n + 1), 1500);
        return () => clearInterval(t);
    }, []);

    if (!isNanopayConfigured() || !address) return null;
    if (RFQ_MAKER_ADDRESS === '0x0000000000000000000000000000000000000000') return null;

    const snap = getChannelSnapshot(
        address as `0x${string}`,
        RFQ_MAKER_ADDRESS as `0x${string}`
    );
    if (!snap) return null;

    // Only render when there's something interesting to show.
    if (snap.totalSpent === 0n && tick === 0) return null;

    const total = parseFloat(formatUnits(snap.totalSpent, 6));
    const claims = Number(snap.nonce);
    const services = Object.keys(snap.byService).length;

    return (
        <div
            style={{
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255, 196, 84, 0.05)',
                border: '1px solid rgba(255, 196, 84, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
            }}
        >
            <div style={{ flex: 1 }}>
                <div
                    style={{
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#FFC454',
                        fontWeight: 700,
                        marginBottom: 2,
                    }}
                >
                    Nanopayments active
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    Agent has accumulated{' '}
                    <span style={{ color: '#FFC454', fontWeight: 700 }}>
                        ${total.toFixed(4)}
                    </span>{' '}
                    across {claims} signed claim{claims === 1 ? '' : 's'} · {services}{' '}
                    service{services === 1 ? '' : 's'}
                </div>
            </div>
        </div>
    );
};

export default NanopayBadge;
