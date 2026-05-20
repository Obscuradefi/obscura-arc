import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useReadContract, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits, encodeFunctionData } from 'viem';
import { useEffectiveAccount } from '../../hooks/useEffectiveAccount';
import { useUnifiedSendTx } from '../../hooks/useUnifiedSendTx';
import { ERC20_ABI } from '../../config/dexConfig';
import { ARC_USDC_ADDRESS, ARC_USDC_DECIMALS, arcTxUrl } from '../../config/arc';
import {
    USYC_TOKEN_ADDRESS,
    USYC_TELLER_ADDRESS,
    USYC_ORACLE_ADDRESS,
    USYC_DECIMALS,
    USYC_TELLER_ABI,
    USYC_ORACLE_ABI,
    USYC_TOKEN_ABI,
} from '../../config/usycConfig';

type Mode = 'deposit' | 'redeem';

const S = {
    card: {
        background: 'rgba(13,13,18,0.85)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: 24,
    },
    input: {
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.09)',
        color: '#F0F0F0',
        padding: '14px 18px',
        borderRadius: 12,
        fontSize: '1.35rem',
        width: '100%',
        outline: 'none',
        fontFamily: 'Inter, system-ui, sans-serif',
    },
    label: {
        fontSize: '0.72rem',
        fontWeight: 600,
        color: 'var(--text-dim)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        marginBottom: 8,
        display: 'block',
    },
    green: 'var(--green-300)',
    dim: 'var(--text-dim)',
};

const StakeTab: React.FC = () => {
    const { address, isConnected } = useEffectiveAccount();
    const { send, isPending, lastHash, error } = useUnifiedSendTx();

    const [mode, setMode] = useState<Mode>('deposit');
    const [amount, setAmount] = useState('');
    const [txHash, setTxHash] = useState<string | null>(null);

    // USDC balance
    const { data: usdcBal } = useReadContract({
        address: ARC_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    // USYC balance
    const { data: usycBal } = useReadContract({
        address: USYC_TOKEN_ADDRESS,
        abi: USYC_TOKEN_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    // USDC allowance to Teller
    const { data: usdcAllowance } = useReadContract({
        address: ARC_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, USYC_TELLER_ADDRESS] : undefined,
        query: { enabled: !!address },
    });

    // Oracle price
    const { data: oracleData } = useReadContract({
        address: USYC_ORACLE_ADDRESS,
        abi: USYC_ORACLE_ABI,
        functionName: 'latestRoundData',
    });

    const oraclePrice = oracleData ? Number((oracleData as readonly bigint[])[1]) / 1e8 : null;
    const estApy = oraclePrice ? ((oraclePrice - 1) * 100).toFixed(2) : '—';

    const parsedAmount = (() => {
        try {
            if (!amount || Number(amount) <= 0) return 0n;
            return parseUnits(amount, mode === 'deposit' ? ARC_USDC_DECIMALS : USYC_DECIMALS);
        } catch {
            return 0n;
        }
    })();

    const needsApproval =
        mode === 'deposit' &&
        parsedAmount > 0n &&
        usdcAllowance !== undefined &&
        (usdcAllowance as bigint) < parsedAmount;

    const handleApprove = async () => {
        const res = await send({
            to: ARC_USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [USYC_TELLER_ADDRESS, parsedAmount],
        });
        setTxHash(res.txHash);
    };

    const handleDeposit = async () => {
        if (!address) return;
        const res = await send({
            to: USYC_TELLER_ADDRESS,
            abi: USYC_TELLER_ABI,
            functionName: 'deposit',
            args: [parsedAmount, address],
        });
        setTxHash(res.txHash);
        setAmount('');
    };

    const handleRedeem = async () => {
        if (!address) return;
        const res = await send({
            to: USYC_TELLER_ADDRESS,
            abi: USYC_TELLER_ABI,
            functionName: 'redeem',
            args: [parsedAmount, address, address],
        });
        setTxHash(res.txHash);
        setAmount('');
    };

    const onSubmit = () => {
        if (needsApproval) return handleApprove();
        if (mode === 'deposit') return handleDeposit();
        return handleRedeem();
    };

    const buttonLabel = (() => {
        if (isPending) return 'Confirming…';
        if (mode === 'deposit' && needsApproval) return 'Approve USDC';
        if (mode === 'deposit') return 'Deposit USDC → USYC';
        return 'Redeem USYC → USDC';
    })();

    const disabled = !isConnected || isPending || parsedAmount === 0n;

    return (
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="glow-text" style={{ fontSize: '2.2rem', marginBottom: 6 }}>
                    Yield
                </h2>
                <p style={{ color: S.dim, marginBottom: 28, fontFamily: 'JetBrains Mono', fontSize: '0.82rem' }}>
                    USYC by Circle · US Treasury yield on Arc Testnet
                </p>

                {/* Info box */}
                <div
                    style={{
                        background: 'rgba(0,200,120,0.04)',
                        border: '1px solid rgba(0,200,120,0.18)',
                        borderRadius: 12,
                        padding: '14px 18px',
                        marginBottom: 24,
                        fontSize: '0.8rem',
                        color: 'rgba(255,255,255,0.72)',
                        lineHeight: 1.6,
                    }}
                >
                    <strong style={{ color: S.green }}>What is USYC?</strong>
                    <br />
                    USYC is Circle's tokenized US Treasury yield product. Deposit USDC to receive USYC tokens
                    whose price appreciates as yield accrues from short-duration US Treasuries. Redeem anytime
                    to get back USDC + accumulated yield.
                </div>

                {/* Entitlements warning */}
                {isConnected && (!usycBal || (usycBal as bigint) === 0n) && (
                    <div
                        style={{
                            background: 'rgba(255,170,80,0.06)',
                            border: '1px solid rgba(255,170,80,0.25)',
                            borderRadius: 12,
                            padding: '14px 18px',
                            marginBottom: 24,
                            fontSize: '0.78rem',
                            color: 'rgba(255,200,140,0.9)',
                            lineHeight: 1.6,
                        }}
                    >
                        <strong style={{ color: '#FFAA50' }}>Whitelist required:</strong>{' '}
                        USYC is a permissioned product. Your wallet address must be whitelisted by Circle
                        before you can deposit. If deposit reverts, visit{' '}
                        <a
                            href="https://faucet.circle.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#FFAA50', textDecoration: 'underline' }}
                        >
                            faucet.circle.com
                        </a>{' '}
                        (select USYC + Arc Testnet) to request access, or contact Circle support.
                    </div>
                )}

                {/* Mode toggle */}
                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        marginBottom: 20,
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 10,
                        padding: 4,
                    }}
                >
                    {(['deposit', 'redeem'] as Mode[]).map((m) => (
                        <button
                            key={m}
                            onClick={() => { setMode(m); setAmount(''); setTxHash(null); }}
                            style={{
                                flex: 1,
                                padding: '10px 0',
                                borderRadius: 8,
                                border: 'none',
                                cursor: 'pointer',
                                fontFamily: 'JetBrains Mono',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                background: mode === m ? 'rgba(0,200,120,0.13)' : 'transparent',
                                color: mode === m ? S.green : S.dim,
                                transition: 'all 0.2s',
                            }}
                        >
                            {m === 'deposit' ? 'Deposit' : 'Redeem'}
                        </button>
                    ))}
                </div>

                {/* Input */}
                <div style={S.card}>
                    <label style={S.label}>
                        {mode === 'deposit' ? 'USDC Amount' : 'USYC Amount'}
                    </label>
                    <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        style={S.input}
                    />
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: S.dim }}>
                        Balance:{' '}
                        {mode === 'deposit'
                            ? usdcBal !== undefined
                                ? formatUnits(usdcBal as bigint, ARC_USDC_DECIMALS)
                                : '—'
                            : usycBal !== undefined
                                ? formatUnits(usycBal as bigint, USYC_DECIMALS)
                                : '—'}
                        {' '}
                        <span
                            style={{ color: S.green, cursor: 'pointer' }}
                            onClick={() => {
                                const bal = mode === 'deposit' ? usdcBal : usycBal;
                                const dec = mode === 'deposit' ? ARC_USDC_DECIMALS : USYC_DECIMALS;
                                if (bal !== undefined) setAmount(formatUnits(bal as bigint, dec));
                            }}
                        >
                            MAX
                        </span>
                    </div>
                </div>

                {/* Submit button */}
                <button
                    onClick={onSubmit}
                    disabled={disabled}
                    style={{
                        width: '100%',
                        marginTop: 16,
                        padding: '15px 0',
                        borderRadius: 12,
                        border: 'none',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        background: disabled
                            ? 'rgba(255,255,255,0.05)'
                            : 'linear-gradient(135deg, rgba(0,200,120,0.85), rgba(0,160,100,0.9))',
                        color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
                        transition: 'all 0.2s',
                    }}
                >
                    {buttonLabel}
                </button>

                {/* Error */}
                {error && (
                    <p style={{ color: '#f87171', fontSize: '0.78rem', marginTop: 10 }}>{error}</p>
                )}

                {/* Tx link */}
                {(txHash || lastHash) && (
                    <div style={{ marginTop: 12, fontSize: '0.78rem' }}>
                        <a
                            href={arcTxUrl((txHash || lastHash)!)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: S.green, textDecoration: 'underline' }}
                        >
                            View on ArcScan ↗
                        </a>
                    </div>
                )}

                {/* Stats row */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: 12,
                        marginTop: 24,
                    }}
                >
                    <StatBox
                        label="USYC Balance"
                        value={usycBal !== undefined ? Number(formatUnits(usycBal as bigint, USYC_DECIMALS)).toFixed(4) : '—'}
                    />
                    <StatBox
                        label="Oracle Price"
                        value={oraclePrice ? `$${oraclePrice.toFixed(6)}` : '—'}
                    />
                    <StatBox label="Est. APY" value={estApy !== '—' ? `${estApy}%` : '—'} />
                </div>
            </motion.div>
        </div>
    );
};

function StatBox({ label, value }: { label: string; value: string }) {
    return (
        <div
            style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                padding: '12px 14px',
                textAlign: 'center',
            }}
        >
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase' }}>
                {label}
            </div>
            <div style={{ fontSize: '0.95rem', fontFamily: 'JetBrains Mono', color: 'var(--green-300)' }}>
                {value}
            </div>
        </div>
    );
}

export default StakeTab;
