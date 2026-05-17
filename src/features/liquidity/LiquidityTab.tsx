import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    useReadContracts,
    useWaitForTransactionReceipt,
    useReadContract,
} from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { useEffectiveAccount } from '../../hooks/useEffectiveAccount';
import { useUnifiedSendTx } from '../../hooks/useUnifiedSendTx';
import { FLUX_ASSETS } from '../../data/fluxAssets';
import { OBSCURA_AMM_ABI, ERC20_ABI } from '../../config/dexConfig';
import {
    OBSCURA_AMM_ADDRESS,
    ARC_USDC_ADDRESS,
    ARC_USDC_DECIMALS,
    arcTxUrl,
} from '../../config/arc';
import { addActivity } from '../../lib/fluxMock';
import { getMockPrice } from '../../lib/priceOracle';

const G = {
    green: 'var(--green-300)',
    greenBg: 'rgba(61,158,78,0.08)',
    greenBorder: 'rgba(61,158,78,0.2)',
    dim: 'var(--text-dim)',
    secondary: 'var(--text-secondary)',
    card: {
        background: 'rgba(13,13,18,0.85)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: 24,
    } as React.CSSProperties,
    input: {
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.09)',
        color: '#F0F0F0',
        padding: '12px 70px 12px 14px',
        borderRadius: 10,
        fontSize: '0.95rem',
        outline: 'none',
        width: '100%',
        fontFamily: 'Inter, system-ui, sans-serif',
        transition: 'border-color 0.2s',
    } as React.CSSProperties,
};

interface PoolCardProps {
    asset: typeof FLUX_ASSETS[0];
    reserveAsset: number;
    reserveUSDC: number;
    userShares: number;
    address: string | undefined;
}

const PoolCard: React.FC<PoolCardProps> = ({
    asset,
    reserveAsset,
    reserveUSDC,
    userShares,
    address,
}) => {
    const [mode, setMode] = useState<'idle' | 'add' | 'remove'>('idle');
    const [amountAsset, setAmountAsset] = useState('');
    const [amountUSDC, setAmountUSDC] = useState('');
    const [sharesToRemove, setSharesToRemove] = useState('');

    const { send, lastHash: hash, isPending } = useUnifiedSendTx();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    // Asset balance + allowance
    const { data: tokenBalance } = useReadContract({
        address: asset.contractAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address as `0x${string}`] : undefined,
        query: { enabled: !!address && !!asset.contractAddress },
    });

    const { data: assetAllowance } = useReadContract({
        address: asset.contractAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address as `0x${string}`, OBSCURA_AMM_ADDRESS] : undefined,
        query: { enabled: !!address && !!asset.contractAddress },
    });

    // USDC balance + allowance
    const { data: usdcBalance } = useReadContract({
        address: ARC_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address as `0x${string}`] : undefined,
        query: { enabled: !!address },
    });

    const { data: usdcAllowance } = useReadContract({
        address: ARC_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address as `0x${string}`, OBSCURA_AMM_ADDRESS] : undefined,
        query: { enabled: !!address },
    });

    const formattedTokenBalance = tokenBalance
        ? Number(formatUnits(tokenBalance as bigint, asset.decimals))
        : 0;
    const formattedUsdcBalance = usdcBalance
        ? Number(formatUnits(usdcBalance as bigint, ARC_USDC_DECIMALS))
        : 0;

    const needsAssetApproval = () => {
        if (!amountAsset) return true;
        if (assetAllowance === undefined) return true;
        try {
            return (assetAllowance as bigint) < parseUnits(amountAsset, asset.decimals);
        } catch {
            return true;
        }
    };
    const needsUsdcApproval = () => {
        if (!amountUSDC) return true;
        if (usdcAllowance === undefined) return true;
        try {
            return (usdcAllowance as bigint) < parseUnits(amountUSDC, ARC_USDC_DECIMALS);
        } catch {
            return true;
        }
    };

    const handleApproveAsset = async () => {
        if (!amountAsset || !asset.contractAddress) return;
        try {
            await send({
                to: asset.contractAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [OBSCURA_AMM_ADDRESS, parseUnits(amountAsset, asset.decimals)],
            });
        } catch (e) {
            console.error('Approve asset failed', e);
        }
    };

    const handleApproveUSDC = async () => {
        if (!amountUSDC) return;
        try {
            await send({
                to: ARC_USDC_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [OBSCURA_AMM_ADDRESS, parseUnits(amountUSDC, ARC_USDC_DECIMALS)],
            });
        } catch (e) {
            console.error('Approve USDC failed', e);
        }
    };

    const handleAddLiquidity = async () => {
        if (!amountAsset || !amountUSDC || !asset.contractAddress) return;
        try {
            await send({
                to: OBSCURA_AMM_ADDRESS,
                abi: OBSCURA_AMM_ABI,
                functionName: 'addLiquidity',
                args: [
                    asset.contractAddress as `0x${string}`,
                    parseUnits(amountAsset, asset.decimals),
                    parseUnits(amountUSDC, ARC_USDC_DECIMALS),
                ],
            });
            addActivity({
                type: 'liquidity',
                description: `Added ${amountAsset} ${asset.symbol} + ${amountUSDC} USDC liquidity`,
            });
            setAmountAsset('');
            setAmountUSDC('');
            setMode('idle');
        } catch (e) {
            console.error('Add liquidity failed', e);
        }
    };

    const handleRemoveLiquidity = async () => {
        if (!sharesToRemove || !asset.contractAddress) return;
        try {
            await send({
                to: OBSCURA_AMM_ADDRESS,
                abi: OBSCURA_AMM_ABI,
                functionName: 'removeLiquidity',
                args: [
                    asset.contractAddress as `0x${string}`,
                    parseUnits(sharesToRemove, 18),
                ],
            });
            addActivity({
                type: 'liquidity',
                description: `Removed ${sharesToRemove} ${asset.symbol} LP shares`,
            });
            setSharesToRemove('');
            setMode('idle');
        } catch (e) {
            console.error('Remove liquidity failed', e);
        }
    };

    const isProcessing = isPending || isConfirming;
    const tvl = reserveUSDC * 2; // USDC value * 2 since pool is balanced
    const apyEstimate = reserveUSDC > 0 ? (5 + (asset.symbol.charCodeAt(0) % 12)).toFixed(1) : '0.0';

    const btnBase: React.CSSProperties = {
        padding: '10px 14px',
        borderRadius: 10,
        fontWeight: 700,
        fontSize: '0.78rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: '1px solid',
        letterSpacing: '0.03em',
    };

    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={G.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#F0F0F0' }}>
                        {asset.symbol} / USDC
                    </div>
                    <div style={{ fontSize: '0.75rem', color: G.dim, marginTop: 2 }}>{asset.name}</div>
                </div>
                <div
                    style={{
                        background: G.greenBg,
                        border: `1px solid ${G.greenBorder}`,
                        padding: '5px 12px',
                        borderRadius: 20,
                        fontSize: '0.78rem',
                        color: G.green,
                        fontWeight: 600,
                    }}
                >
                    {apyEstimate}% APY
                </div>
            </div>

            <div
                style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    padding: '14px 16px',
                    borderRadius: 10,
                    marginBottom: 18,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span
                        style={{
                            fontSize: '0.7rem',
                            color: G.dim,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                        }}
                    >
                        Reserves
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F0F0F0' }}>
                        {reserveAsset.toLocaleString(undefined, { maximumFractionDigits: 4 })} {asset.symbol} ·{' '}
                        {reserveUSDC.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
                    </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span
                        style={{
                            fontSize: '0.7rem',
                            color: G.dim,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                        }}
                    >
                        TVL
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: G.green }}>
                        ${tvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {address && userShares > 0 && (
                <div
                    style={{
                        background: G.greenBg,
                        border: `1px solid ${G.greenBorder}`,
                        padding: '10px 14px',
                        borderRadius: 8,
                        marginBottom: 16,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <span
                        style={{
                            fontSize: '0.7rem',
                            color: G.green,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            fontWeight: 600,
                        }}
                    >
                        Your LP shares
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: G.green }}>
                        {userShares.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                </div>
            )}

            {mode === 'idle' ? (
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        style={{ ...btnBase, flex: 1, background: G.greenBg, borderColor: G.greenBorder, color: G.green }}
                        onClick={() => setMode('add')}
                        disabled={!address}
                    >
                        Add
                    </button>
                    <button
                        style={{
                            ...btnBase,
                            flex: 1,
                            background: 'rgba(157,78,221,0.08)',
                            borderColor: 'rgba(157,78,221,0.25)',
                            color: 'var(--neon-purple)',
                        }}
                        onClick={() => setMode('remove')}
                        disabled={!address || userShares === 0}
                    >
                        Remove
                    </button>
                </div>
            ) : mode === 'add' ? (
                <div>
                    <div style={{ position: 'relative', marginBottom: 10 }}>
                        <input
                            type="number"
                            placeholder={`${asset.symbol} amount`}
                            value={amountAsset}
                            onChange={(e) => setAmountAsset(e.target.value)}
                            style={G.input}
                        />
                        <button
                            onClick={() => setAmountAsset(formattedTokenBalance.toString())}
                            style={{
                                position: 'absolute',
                                right: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: G.greenBg,
                                border: `1px solid ${G.greenBorder}`,
                                color: G.green,
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            MAX
                        </button>
                    </div>
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                        <input
                            type="number"
                            placeholder="USDC amount"
                            value={amountUSDC}
                            onChange={(e) => setAmountUSDC(e.target.value)}
                            style={G.input}
                        />
                        <button
                            onClick={() => setAmountUSDC(formattedUsdcBalance.toString())}
                            style={{
                                position: 'absolute',
                                right: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: G.greenBg,
                                border: `1px solid ${G.greenBorder}`,
                                color: G.green,
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            MAX
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {needsAssetApproval() && (
                            <button
                                style={{ ...btnBase, background: G.greenBg, borderColor: G.greenBorder, color: G.green }}
                                onClick={handleApproveAsset}
                                disabled={!amountAsset || isProcessing}
                            >
                                {isProcessing ? 'Approving…' : `1. Approve ${asset.symbol}`}
                            </button>
                        )}
                        {needsUsdcApproval() && (
                            <button
                                style={{ ...btnBase, background: G.greenBg, borderColor: G.greenBorder, color: G.green }}
                                onClick={handleApproveUSDC}
                                disabled={!amountUSDC || isProcessing}
                            >
                                {isProcessing ? 'Approving…' : '2. Approve USDC'}
                            </button>
                        )}
                        <button
                            style={{ ...btnBase, background: G.greenBg, borderColor: G.greenBorder, color: G.green }}
                            onClick={handleAddLiquidity}
                            disabled={
                                !amountAsset ||
                                !amountUSDC ||
                                isProcessing ||
                                needsAssetApproval() ||
                                needsUsdcApproval()
                            }
                        >
                            {isProcessing ? 'Adding…' : 'Add liquidity'}
                        </button>
                    </div>
                    <button
                        style={{
                            width: '100%',
                            marginTop: 8,
                            background: 'transparent',
                            border: 'none',
                            color: G.dim,
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: '6px',
                        }}
                        onClick={() => {
                            setMode('idle');
                            setAmountAsset('');
                            setAmountUSDC('');
                        }}
                    >
                        Cancel
                    </button>
                </div>
            ) : (
                <div>
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                        <input
                            type="number"
                            placeholder="Shares to remove"
                            value={sharesToRemove}
                            onChange={(e) => setSharesToRemove(e.target.value)}
                            style={G.input}
                        />
                        <button
                            onClick={() => setSharesToRemove(userShares.toString())}
                            style={{
                                position: 'absolute',
                                right: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: G.greenBg,
                                border: `1px solid ${G.greenBorder}`,
                                color: G.green,
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            MAX
                        </button>
                    </div>
                    <button
                        style={{
                            ...btnBase,
                            width: '100%',
                            background: 'rgba(157,78,221,0.1)',
                            borderColor: 'rgba(157,78,221,0.3)',
                            color: 'var(--neon-purple)',
                        }}
                        onClick={handleRemoveLiquidity}
                        disabled={!sharesToRemove || isProcessing}
                    >
                        {isProcessing ? 'Removing…' : 'Remove liquidity'}
                    </button>
                    <button
                        style={{
                            width: '100%',
                            marginTop: 8,
                            background: 'transparent',
                            border: 'none',
                            color: G.dim,
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: '6px',
                        }}
                        onClick={() => {
                            setMode('idle');
                            setSharesToRemove('');
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {hash && (
                <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.74rem' }}>
                    <a href={arcTxUrl(hash)} target="_blank" rel="noopener noreferrer" style={{ color: G.green }}>
                        {isConfirmed ? 'Confirmed' : 'Pending'} — View on ArcScan
                    </a>
                </div>
            )}
        </motion.div>
    );
};

const LiquidityTab: React.FC = () => {
    const { address } = useEffectiveAccount();
    // USDC is the quote, not a pool side — exclude it.
    const poolAssets = FLUX_ASSETS.filter((a) => a.deployed && !a.isQuote);

    const reserveContracts = poolAssets.map((asset) => ({
        address: OBSCURA_AMM_ADDRESS,
        abi: OBSCURA_AMM_ABI,
        functionName: 'reserves' as const,
        args: [asset.contractAddress as `0x${string}`] as const,
    }));
    const { data: reservesData } = useReadContracts({ contracts: reserveContracts });

    const sharesContracts = address
        ? poolAssets.map((asset) => ({
              address: OBSCURA_AMM_ADDRESS,
              abi: OBSCURA_AMM_ABI,
              functionName: 'liquidityShares' as const,
              args: [address as `0x${string}`, asset.contractAddress as `0x${string}`] as const,
          }))
        : [];
    const { data: sharesData } = useReadContracts({ contracts: sharesContracts });

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: 28 }}>
                <h2
                    style={{
                        fontSize: '1.6rem',
                        fontWeight: 800,
                        letterSpacing: '-0.04em',
                        color: '#F0F0F0',
                        margin: '0 0 4px',
                    }}
                >
                    Liquidity pools
                </h2>
                <div
                    style={{
                        fontSize: '0.75rem',
                        color: G.dim,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                    }}
                >
                    Provide USDC-paired liquidity on Arc Testnet · 0.30% pool fee
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                {poolAssets.map((asset, index) => {
                    const tuple = reservesData?.[index]?.result as readonly [bigint, bigint] | undefined;
                    const reserveAsset = tuple ? Number(formatUnits(tuple[0], asset.decimals)) : 0;
                    const reserveUSDC = tuple ? Number(formatUnits(tuple[1], ARC_USDC_DECIMALS)) : 0;
                    const userSharesBN = sharesData?.[index]?.result as bigint | undefined;
                    const userSharesFormatted = userSharesBN ? Number(formatUnits(userSharesBN, 18)) : 0;

                    return (
                        <PoolCard
                            key={asset.symbol}
                            asset={asset}
                            reserveAsset={reserveAsset}
                            reserveUSDC={reserveUSDC}
                            userShares={userSharesFormatted}
                            address={address}
                        />
                    );
                })}
            </div>

            <div
                style={{
                    marginTop: 28,
                    padding: '16px 20px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    fontSize: '0.78rem',
                    color: G.dim,
                }}
            >
                <strong style={{ color: G.green }}>Note:</strong> ObscuraAMM uses USDC as the universal
                quote token. Each pool pairs one asset with USDC and pricing is constant-product (
                <code>x · y = k</code>) without any external oracle dependency.
            </div>
        </div>
    );
};

export default LiquidityTab;
