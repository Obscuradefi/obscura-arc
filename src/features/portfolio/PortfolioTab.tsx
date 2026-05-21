import React, { useEffect, useState, useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { motion } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffectiveAccount } from '../../hooks/useEffectiveAccount';
import { getActivityHistory, type SwapActivity } from '../../lib/fluxMock';
import { FLUX_ASSETS } from '../../data/fluxAssets';
import { useTokenBalance } from '../../hooks/useTokenBalance';
import { TabId } from '../../components/AppTabs';
import {
    SHIELD_ABI,
    PRIVACY_TOKENS,
} from '../../config/shieldConfig';
import { OBSCURA_SHIELD_ADDRESS, OBSCURA_AMM_ADDRESS } from '../../config/arc';
import { getMockPrice } from '../../lib/priceOracle';
import { OBSCURA_AMM_ABI, ERC20_ABI } from '../../config/dexConfig';
import TokenIcon from '../../components/TokenIcon';

const PortfolioTab = ({ onNavigate }: { onNavigate?: (tab: TabId) => void }) => {
    const { address, isConnected, source } = useEffectiveAccount();
    const [activities, setActivities] = useState<SwapActivity[]>([]);
    const [showEncrypted, setShowEncrypted] = useState(false);

    const deployedAssets = FLUX_ASSETS.filter((a) => a.deployed);

    // Batch-read encrypted balances and on-chain prices for every deployed asset.
    // We only build the query list when the user is connected; passing
    // `args: [undefined, ...]` to wagmi makes the entire batch fail, which
    // surfaces as Portfolio rendering blank.
    const contractsToRead: any[] = useMemo(() => {
        if (!address) return [];
        const calls: any[] = [];
        deployedAssets.forEach((a) => {
            // Shield balance
            calls.push({
                address: OBSCURA_SHIELD_ADDRESS,
                abi: SHIELD_ABI,
                functionName: 'getEncryptedBalance',
                args: [address as `0x${string}`, a.contractAddress as `0x${string}`],
            });
            // On-chain Pyth price from AMM (scaled to 1e18)
            calls.push({
                address: OBSCURA_AMM_ADDRESS,
                abi: OBSCURA_AMM_ABI,
                functionName: 'getPrice',
                args: [a.contractAddress as `0x${string}`],
            });
        });
        return calls;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, deployedAssets.length]);

    const multiQueries = useReadContracts({
        contracts: contractsToRead,
        query: {
            enabled: !!address && isConnected && contractsToRead.length > 0,
            refetchInterval: 6000,
        },
    });

    const lpAssets = useMemo(() => FLUX_ASSETS.filter(a => a.deployed && !a.isQuote), []);

    const lpContracts = useMemo(() => {
        if (!address) return [];
        return lpAssets.map(a => ({
            address: OBSCURA_AMM_ADDRESS,
            abi: OBSCURA_AMM_ABI,
            functionName: 'liquidityShares',
            args: [address as `0x${string}`, a.contractAddress as `0x${string}`],
        }));
    }, [address, lpAssets]);

    const lpQueries = useReadContracts({
        contracts: lpContracts as any[],
        query: { enabled: !!address && isConnected && lpContracts.length > 0, refetchInterval: 6000 },
    });

    const lpPositions = lpAssets.map((a, i) => {
        const row = lpQueries.data?.[i];
        const shares = row?.status === 'success' && row.result !== undefined
            ? parseFloat(formatUnits(row.result as bigint, 18))
            : 0;
        const price = pricesBySymbol[a.symbol] ?? getMockPrice(a.symbol);
        const valueUsd = shares * price * 2;
        return { asset: a, shares, valueUsd };
    }).filter(p => p.shares > 0);

    const encryptedBySymbol: Record<string, number> = {};
    const pricesBySymbol: Record<string, number> = {};

    deployedAssets.forEach((a, i) => {
        // 2 queries per asset: 0=balance, 1=price
        const balRow = multiQueries.data?.[i * 2];
        const priceRow = multiQueries.data?.[i * 2 + 1];

        if (balRow?.status === 'success' && balRow.result !== undefined) {
            encryptedBySymbol[a.symbol] = parseFloat(
                formatUnits(balRow.result as bigint, a.decimals)
            );
        }
        if (priceRow?.status === 'success' && priceRow.result !== undefined) {
            // getPrice returns scaled to 1e18
            pricesBySymbol[a.symbol] = parseFloat(
                formatUnits(priceRow.result as bigint, 18)
            );
        } else {
            pricesBySymbol[a.symbol] = getMockPrice(a.symbol);
        }
    });

    useEffect(() => {
        setActivities(getActivityHistory());
        const interval = setInterval(() => setActivities(getActivityHistory()), 2000);
        return () => clearInterval(interval);
    }, []);

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'swap':
                return '⇄';
            case 'shield':
                return '◆';
            case 'unshield':
                return '◇';
            case 'faucet':
                return '∴';
            default:
                return '·';
        }
    };

    if (!isConnected) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        background: 'rgba(13,13,18,0.85)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 16,
                        padding: '56px 48px',
                        textAlign: 'center',
                        maxWidth: 480,
                    }}
                >
                    <div
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            background: 'rgba(61,158,78,0.08)',
                            border: '1px solid rgba(61,158,78,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 22px',
                            fontSize: '1.5rem',
                        }}
                    >
                        ◆
                    </div>
                    <h2
                        style={{
                            fontSize: '1.35rem',
                            fontWeight: 800,
                            letterSpacing: '-0.03em',
                            color: '#F0F0F0',
                            marginBottom: 10,
                        }}
                    >
                        Connect your wallet
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 26, fontSize: '0.88rem', lineHeight: 1.65 }}>
                        Connect to Arc Testnet to view your portfolio.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <ConnectButton label="Connect wallet" />
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}
        >
            <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#F0F0F0', margin: '0 0 4px' }}>
                    Portfolio
                </h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Public + shielded balances on Arc Testnet
                </div>
            </div>

            <PortfolioSummaryCard
                userAddress={address}
                encryptedBySymbol={encryptedBySymbol}
                pricesBySymbol={pricesBySymbol}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                    {
                        tab: 'swap',
                        label: 'Swap',
                        desc: 'Trade against ObscuraAMM',
                        color: 'var(--green-400)',
                        bg: 'rgba(61,158,78,0.08)',
                        border: 'rgba(61,158,78,0.18)',
                    },
                    {
                        tab: 'shield',
                        label: 'Shield',
                        desc: 'Programmable privacy levels',
                        color: 'var(--neon-purple)',
                        bg: 'rgba(157,78,221,0.08)',
                        border: 'rgba(157,78,221,0.18)',
                    },
                    {
                        tab: 'liquidity',
                        label: 'Liquidity',
                        desc: 'Provide USDC pools',
                        color: 'var(--green-300)',
                        bg: 'rgba(61,158,78,0.05)',
                        border: 'rgba(61,158,78,0.12)',
                    },
                ].map((item) => (
                    <div
                        key={item.tab}
                        onClick={() => onNavigate?.(item.tab as any)}
                        style={{
                            background: 'rgba(13,13,18,0.85)',
                            border: `1px solid rgba(255,255,255,0.07)`,
                            borderRadius: 14,
                            padding: '22px 20px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.25s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = item.border;
                            e.currentTarget.style.background = item.bg;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                            e.currentTarget.style.background = 'rgba(13,13,18,0.85)';
                        }}
                    >
                        <div
                            style={{
                                fontWeight: 800,
                                fontSize: '1rem',
                                letterSpacing: '-0.02em',
                                color: item.color,
                                marginBottom: 6,
                            }}
                        >
                            {item.label}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{item.desc}</div>
                    </div>
                ))}
            </div>

            {/* assets table */}
            <div
                style={{
                    background: 'rgba(13,13,18,0.85)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16,
                    padding: '24px 28px',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#F0F0F0', margin: 0 }}>
                        Your assets
                    </h3>
                    <button
                        onClick={() => setShowEncrypted((s) => !s)}
                        style={{
                            background: 'rgba(157,78,221,0.08)',
                            border: '1px solid rgba(157,78,221,0.2)',
                            color: 'var(--neon-purple)',
                            padding: '7px 18px',
                            borderRadius: 8,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            letterSpacing: '0.04em',
                        }}
                    >
                        {showEncrypted ? 'Hide shielded' : 'Reveal shielded'}
                    </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                {['Asset', 'Public balance', 'Shielded', 'Value (USD)'].map((h, i) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: '12px 18px',
                                            fontWeight: 600,
                                            fontSize: '0.68rem',
                                            color: 'var(--text-dim)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.07em',
                                            textAlign: i === 3 ? 'right' : 'left',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {FLUX_ASSETS.map((asset) => (
                                <AssetRow
                                    key={asset.symbol}
                                    asset={asset}
                                    userAddress={address}
                                    encryptedBalance={encryptedBySymbol[asset.symbol] ?? 0}
                                    showEncrypted={showEncrypted}
                                    price={pricesBySymbol[asset.symbol] ?? getMockPrice(asset.symbol)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* liquidity positions */}
            {lpPositions.length > 0 && (
                <div
                    style={{
                        background: 'rgba(13,13,18,0.85)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 16,
                        padding: '24px 28px',
                    }}
                >
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#F0F0F0', margin: '0 0 18px' }}>
                        Liquidity Positions
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                        {lpPositions.map(({ asset, shares, valueUsd }) => (
                            <div
                                key={asset.symbol}
                                style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: 12,
                                    padding: '18px 20px',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <TokenIcon symbol={asset.symbol} size={28} />
                                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#F0F0F0' }}>
                                        {asset.symbol} / USDC
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4 }}>LP Shares</div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--green-300)' }}>
                                    {shares.toFixed(4)}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 8 }}>
                                    Est. value: <span style={{ color: '#F0F0F0', fontWeight: 600 }}>${valueUsd.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* activity */}
            <div>
                <h3
                    style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: 'var(--green-400)',
                        marginBottom: 18,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                    }}
                >
                    Activity history
                </h3>
                {activities.length === 0 ? (
                    <div
                        style={{
                            background: 'rgba(13,13,18,0.7)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 14,
                            padding: '40px',
                            textAlign: 'center',
                        }}
                    >
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
                            No activity yet. Start trading to see your history.
                        </p>
                    </div>
                ) : (
                    <div
                        style={{
                            background: 'rgba(13,13,18,0.85)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 14,
                            padding: '20px 24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                        }}
                    >
                        {activities.map((activity) => (
                            <div
                                key={activity.id}
                                style={{
                                    padding: '13px 16px',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'background 0.2s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div
                                        style={{
                                            fontSize: '1rem',
                                            width: 28,
                                            height: 28,
                                            borderRadius: 8,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'rgba(61,158,78,0.08)',
                                            color: 'var(--green-300)',
                                        }}
                                    >
                                        {getActivityIcon(activity.type)}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.86rem', color: '#F0F0F0', marginBottom: 2 }}>
                                            {activity.description}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                            {formatTimestamp(activity.timestamp)}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        fontSize: '0.68rem',
                                        padding: '4px 10px',
                                        background: 'rgba(61,158,78,0.08)',
                                        color: 'var(--green-400)',
                                        borderRadius: 7,
                                        border: '1px solid rgba(61,158,78,0.15)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                        fontWeight: 600,
                                    }}
                                >
                                    {activity.type}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

function PortfolioSummaryCard({
    userAddress,
    encryptedBySymbol,
    pricesBySymbol,
}: {
    userAddress: string | undefined;
    encryptedBySymbol: Record<string, number>;
    pricesBySymbol: Record<string, number>;
}) {
    const deployedAssets = FLUX_ASSETS.filter((a) => a.deployed);

    const publicBalanceQueries = useReadContracts({
        contracts: deployedAssets.map((a) => ({
            address: a.contractAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [userAddress as `0x${string}`],
        })),
        query: { enabled: !!userAddress, refetchInterval: 6000 },
    });

    let publicUsd = 0;
    let shieldedUsd = 0;

    deployedAssets.forEach((a, i) => {
        const price = pricesBySymbol[a.symbol] ?? getMockPrice(a.symbol);
        const enc = encryptedBySymbol[a.symbol] ?? 0;
        shieldedUsd += enc * price;

        const balRow = publicBalanceQueries.data?.[i];
        if (balRow?.status === 'success' && balRow.result !== undefined) {
            const pubBal = parseFloat(formatUnits(balRow.result as bigint, a.decimals));
            publicUsd += pubBal * price;
        }
    });

    const totalUsd = publicUsd + shieldedUsd;

    return (
        <div
            style={{
                background: 'rgba(13,13,18,0.85)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                padding: '32px 36px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(ellipse at 80% 50%, rgba(61,158,78,0.06) 0%, transparent 60%)',
                    pointerEvents: 'none',
                }}
            />
            
            <div>
                <div
                    style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-dim)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: 8,
                    }}
                >
                    Total Portfolio Value
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
                    <div
                        style={{
                            fontSize: '3.2rem',
                            fontWeight: 800,
                            letterSpacing: '-0.05em',
                            color: '#F0F0F0',
                            lineHeight: 1,
                        }}
                    >
                        ${totalUsd.toFixed(2)}
                    </div>
                </div>
            </div>
            
            <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                Wallet: <code style={{ color: 'var(--green-300)' }}>{userAddress?.slice(0, 6)}…{userAddress?.slice(-4)}</code>
            </div>
        </div>
    );
}

function AssetRow({
    asset,
    userAddress,
    encryptedBalance,
    showEncrypted,
    price,
}: {
    asset: typeof FLUX_ASSETS[0];
    userAddress: string | undefined;
    encryptedBalance: number;
    showEncrypted: boolean;
    price: number;
}) {
    const { formattedBalance } = useTokenBalance(
        asset.deployed ? asset.contractAddress : undefined,
        userAddress,
        asset.decimals
    );
    const balance = asset.deployed ? formattedBalance : 0;
    const isReal = asset.deployed;
    const colors = ['#2775CA', '#26A17B', '#8E8E93', '#FFC107', '#000000', '#F2A900'];
    const colorIndex = asset.symbol.charCodeAt(0) % colors.length;
    const cSym = PRIVACY_TOKENS[asset.symbol] ?? `c${asset.symbol}`;
    const totalUsd = (balance + encryptedBalance) * price;


    return (
        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
            <td style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <TokenIcon symbol={asset.symbol} size={36} />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F0F0F0' }}>{asset.symbol}</div>
                            {asset.isQuote && (
                                <span
                                    style={{
                                        fontSize: '0.58rem',
                                        padding: '2px 6px',
                                        background: 'rgba(61,158,78,0.18)',
                                        color: 'var(--green-300)',
                                        borderRadius: 5,
                                        fontWeight: 600,
                                    }}
                                >
                                    GAS / QUOTE
                                </span>
                            )}
                            {!isReal && (
                                <span
                                    style={{
                                        fontSize: '0.58rem',
                                        padding: '2px 6px',
                                        background: 'rgba(157,78,221,0.15)',
                                        color: 'var(--neon-purple)',
                                        borderRadius: 5,
                                        fontWeight: 600,
                                    }}
                                >
                                    NOT DEPLOYED
                                </span>
                            )}
                        </div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.76rem' }}>{asset.name}</div>
                    </div>
                </div>
            </td>
            <td style={{ padding: '14px 18px', fontSize: '0.95rem', fontWeight: 600, color: '#F0F0F0' }}>
                {balance.toFixed(4)}
            </td>
            <td
                style={{
                    padding: '14px 18px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: encryptedBalance > 0 ? 'var(--neon-purple)' : 'var(--text-dim)',
                }}
            >
                {encryptedBalance > 0
                    ? `${showEncrypted ? encryptedBalance.toFixed(4) : '••••'} ${cSym}`
                    : '—'}
            </td>
            <td
                style={{
                    padding: '14px 18px',
                    fontSize: '0.95rem',
                    color: isReal ? '#F0F0F0' : 'var(--text-dim)',
                    textAlign: 'right',
                }}
            >
                ${totalUsd.toFixed(2)}
            </td>
        </tr>
    );
}

export default PortfolioTab;
