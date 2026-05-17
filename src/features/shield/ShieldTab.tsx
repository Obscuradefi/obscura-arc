import React, { useMemo, useState } from 'react';
import {
  useReadContract,
  useWaitForTransactionReceipt,
  useReadContracts,
} from 'wagmi';
import { parseUnits, formatUnits, keccak256, stringToHex } from 'viem';
import { motion } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { addActivity } from '../../lib/fluxMock';
import { useEffectiveAccount } from '../../hooks/useEffectiveAccount';
import { useUnifiedSendTx } from '../../hooks/useUnifiedSendTx';
import {
  SHIELD_ABI,
  SHIELD_CONTRACT_ADDRESS,
  PRIVACY_LEVELS,
  PrivacyLevel,
  PRIVACY_TOKENS,
} from '../../config/shieldConfig';
import { ERC20_ABI } from '../../config/dexConfig';
import { FLUX_ASSETS, getAsset } from '../../data/fluxAssets';
import { arcTxUrl } from '../../config/arc';

const G = {
  green: 'var(--green-300)',
  greenBg: 'rgba(61,158,78,0.06)',
  greenBorder: 'rgba(61,158,78,0.2)',
  dim: 'var(--text-dim)',
  secondary: 'var(--text-secondary)',
  card: {
    background: 'rgba(13,13,18,0.85)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: '28px 28px',
  } as React.CSSProperties,
  label: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-dim)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: 8,
  } as React.CSSProperties,
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.09)',
  color: '#F0F0F0',
  padding: '13px 80px 13px 16px',
  borderRadius: 12,
  fontSize: '1.1rem',
  outline: 'none',
  width: '100%',
  fontFamily: 'Inter, system-ui, sans-serif',
  transition: 'border-color 0.2s',
};

interface ShieldEntryRow {
  entryId: number;
  amount: bigint;
  unlockAt: number;
  level: number;
  active: boolean;
}

const ShieldTab: React.FC = () => {
  const { address, isConnected } = useEffectiveAccount();

  const [tokenSym, setTokenSym] = useState<string>('USDC');
  const [shieldAmount, setShieldAmount] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(PrivacyLevel.MEDIUM);

  const asset = getAsset(tokenSym);
  const tokenAddress = (asset?.contractAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`;
  const tokenDecimals = asset?.decimals ?? 18;

  // ---------- public balance ----------
  const { data: balanceData, refetch: refetchPublic } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: isConnected && !!address && asset?.deployed },
  });

  // ---------- encrypted balance ----------
  const { data: encryptedBalanceData, refetch: refetchPrivate } = useReadContract({
    address: SHIELD_CONTRACT_ADDRESS,
    abi: SHIELD_ABI,
    functionName: 'getEncryptedBalance',
    args: [address as `0x${string}`, tokenAddress],
    query: { enabled: isConnected && !!address && asset?.deployed },
  });

  // ---------- entry list ----------
  const { data: entryCountData, refetch: refetchCount } = useReadContract({
    address: SHIELD_CONTRACT_ADDRESS,
    abi: SHIELD_ABI,
    functionName: 'getEntryCount',
    args: [address as `0x${string}`, tokenAddress],
    query: { enabled: isConnected && !!address && asset?.deployed },
  });

  const entryCount = entryCountData ? Number(entryCountData as bigint) : 0;

  const entriesQuery = useReadContracts({
    contracts: useMemo(
      () =>
        Array.from({ length: entryCount }).map((_, i) => ({
          address: SHIELD_CONTRACT_ADDRESS,
          abi: SHIELD_ABI,
          functionName: 'getEntry' as const,
          args: [address as `0x${string}`, tokenAddress, BigInt(i)] as const,
        })),
      [entryCount, address, tokenAddress]
    ),
    query: { enabled: entryCount > 0 && !!address },
  });

  const entries: ShieldEntryRow[] = useMemo(() => {
    if (!entriesQuery.data) return [];
    return entriesQuery.data
      .map((row, i) => {
        if (row.status !== 'success' || !row.result) return null;
        const [amount, unlockAt, level, active] = row.result as readonly [bigint, bigint, number, boolean];
        return {
          entryId: i,
          amount,
          unlockAt: Number(unlockAt),
          level,
          active,
        };
      })
      .filter((e): e is ShieldEntryRow => e !== null && e.active);
  }, [entriesQuery.data]);

  // ---------- writes ----------
  const { send, lastHash: hash, isPending: isWriting } = useUnifiedSendTx();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  if (isConfirmed) {
    refetchPublic();
    refetchPrivate();
    refetchCount();
    entriesQuery.refetch();
  }

  const handleApprove = async () => {
    if (!shieldAmount || isNaN(Number(shieldAmount)) || !asset?.deployed) return;
    try {
      await send({
        to: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SHIELD_CONTRACT_ADDRESS, parseUnits(shieldAmount, tokenDecimals)],
      });
    } catch (e) {
      console.error('Shield approve failed', e);
    }
  };

  const handleShield = async () => {
    if (!shieldAmount || isNaN(Number(shieldAmount)) || !asset?.deployed) return;
    const salt = keccak256(stringToHex(`obscura:${address}:${Date.now()}:${Math.random()}`));
    try {
      await send({
        to: SHIELD_CONTRACT_ADDRESS,
        abi: SHIELD_ABI,
        functionName: 'shield',
        args: [tokenAddress, parseUnits(shieldAmount, tokenDecimals), privacyLevel, salt],
      });
      addActivity({
        type: 'shield',
        description: `Shielded ${shieldAmount} ${tokenSym} (${PRIVACY_LEVELS[privacyLevel].label})`,
      });
      setShieldAmount('');
    } catch (e) {
      console.error('Shield failed', e);
    }
  };

  const handleUnshield = async (entryId: number) => {
    if (!asset?.deployed) return;
    const salt = keccak256(stringToHex(`obscura:unshield:${address}:${entryId}`));
    try {
      await send({
        to: SHIELD_CONTRACT_ADDRESS,
        abi: SHIELD_ABI,
        functionName: 'unshield',
        args: [tokenAddress, BigInt(entryId), salt],
      });
      addActivity({ type: 'unshield', description: `Unshielded ${tokenSym} entry #${entryId}` });
    } catch (e) {
      console.error('Unshield failed', e);
    }
  };

  if (!isConnected) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ ...G.card, textAlign: 'center', maxWidth: 480, padding: '60px 48px' }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: G.greenBg,
              border: `1px solid ${G.greenBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '1.6rem',
            }}
          >
            🔒
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#F0F0F0', marginBottom: 10 }}>
            Access restricted
          </h2>
          <p style={{ color: G.secondary, marginBottom: 28, fontSize: '0.9rem', lineHeight: 1.65 }}>
            Connect your wallet to access the Obscura Shield Protocol on Arc Testnet.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ConnectButton label="Connect wallet" />
          </div>
        </motion.div>
      </div>
    );
  }

  const formattedBalance = balanceData ? formatUnits(balanceData as bigint, tokenDecimals) : '0';
  const encryptedBalanceVal = encryptedBalanceData
    ? parseFloat(formatUnits(encryptedBalanceData as bigint, tokenDecimals))
    : 0;
  const cTokenSymbol = PRIVACY_TOKENS[tokenSym] ?? `c${tokenSym}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      <div>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#F0F0F0', margin: '0 0 4px' }}>
          Shield Vault
        </h2>
        <div style={{ fontSize: '0.75rem', color: G.dim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Programmable privacy on Arc Testnet
        </div>
      </div>

      {/* asset + privacy-level selector */}
      <div style={{ ...G.card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={G.label}>Asset</div>
          <select
            value={tokenSym}
            onChange={(e) => setTokenSym(e.target.value)}
            style={{
              ...inputStyle,
              padding: '12px 16px',
              cursor: 'pointer',
            }}
          >
            {FLUX_ASSETS.filter((a) => a.deployed).map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.symbol} — {a.name}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 12, fontSize: '0.78rem', color: G.dim }}>
            Public balance:{' '}
            <span style={{ color: '#F0F0F0', fontWeight: 600 }}>
              {parseFloat(formattedBalance).toFixed(4)} {tokenSym}
            </span>
          </div>
        </div>

        <div>
          <div style={G.label}>Privacy level</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[PrivacyLevel.LOW, PrivacyLevel.MEDIUM, PrivacyLevel.HIGH].map((lvl) => {
              const meta = PRIVACY_LEVELS[lvl];
              const active = privacyLevel === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => setPrivacyLevel(lvl)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: active ? 'rgba(61,158,78,0.12)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${active ? 'var(--green-600)' : 'rgba(255,255,255,0.07)'}`,
                    color: active ? 'var(--green-200)' : '#F0F0F0',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{meta.label}</div>
                  <div style={{ fontSize: '0.72rem', color: G.dim, marginTop: 2 }}>{meta.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* shield action */}
      <div style={G.card}>
        <div style={G.label}>Shield {tokenSym}</div>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            type="text"
            placeholder="0.00"
            value={shieldAmount}
            onChange={(e) => setShieldAmount(e.target.value)}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = 'var(--green-600)')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
          />
          <button
            onClick={() => setShieldAmount(formattedBalance)}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(61,158,78,0.1)',
              border: '1px solid var(--green-700)',
              color: 'var(--green-300)',
              padding: '5px 12px',
              borderRadius: 7,
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            MAX
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleApprove}
            disabled={!asset?.deployed}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 10,
              background: 'rgba(61,158,78,0.08)',
              border: '1px solid var(--green-700)',
              color: 'var(--green-200)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: asset?.deployed ? 'pointer' : 'not-allowed',
              opacity: asset?.deployed ? 1 : 0.5,
              letterSpacing: '0.04em',
            }}
          >
            1. Approve
          </button>
          <button
            onClick={handleShield}
            disabled={!asset?.deployed}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 10,
              background: 'rgba(61,158,78,0.15)',
              border: '1px solid var(--green-600)',
              color: 'var(--green-100)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: asset?.deployed ? 'pointer' : 'not-allowed',
              opacity: asset?.deployed ? 1 : 0.5,
              letterSpacing: '0.04em',
            }}
          >
            2. Shield ({PRIVACY_LEVELS[privacyLevel].label})
          </button>
        </div>
      </div>

      {/* encrypted vault */}
      <div style={{ ...G.card, border: '1px solid rgba(157,78,221,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ ...G.label, color: 'var(--neon-purple)', margin: 0 }}>Encrypted vault</div>
          <div style={{ fontSize: '0.77rem', color: G.dim }}>
            {cTokenSymbol} ·{' '}
            <span style={{ color: 'var(--neon-purple)', fontWeight: 700 }}>
              {encryptedBalanceVal.toFixed(4)}
            </span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: G.dim }}>
            No active shielded entries. Deposit above to create one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entries.map((e) => {
              const meta = PRIVACY_LEVELS[e.level as PrivacyLevel];
              const now = Math.floor(Date.now() / 1000);
              const locked = now < e.unlockAt;
              const remaining = locked ? formatRemaining(e.unlockAt - now) : null;
              return (
                <div
                  key={e.entryId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(157,78,221,0.05)',
                    border: '1px solid rgba(157,78,221,0.15)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#F0F0F0' }}>
                      {parseFloat(formatUnits(e.amount, tokenDecimals)).toFixed(4)} {tokenSym}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: G.dim, marginTop: 2 }}>
                      Entry #{e.entryId} · {meta?.label ?? 'Unknown'} privacy
                      {locked ? ` · unlocks in ${remaining}` : ' · unlocked'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnshield(e.entryId)}
                    disabled={locked}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      background: locked ? 'rgba(157,78,221,0.05)' : 'rgba(157,78,221,0.15)',
                      border: '1px solid rgba(157,78,221,0.3)',
                      color: locked ? G.dim : 'var(--neon-purple)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: locked ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Unshield
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hash && (
        <div style={{ textAlign: 'center', fontSize: '0.77rem', color: G.dim }}>
          <a
            href={arcTxUrl(hash)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: G.green }}
          >
            {isConfirming ? 'Confirming...' : 'Confirmed'} — View on ArcScan
          </a>
        </div>
      )}
    </motion.div>
  );
};

function formatRemaining(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  return `${Math.ceil(seconds / 3600)}h`;
}

export default ShieldTab;
