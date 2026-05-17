import React, { useState, useEffect } from 'react';
import { useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { motion } from 'framer-motion';
import { OBSCURA_AMM_ABI } from '../../config/dexConfig';
import { OBSCURA_RFQ_ABI } from '../../config/rfqConfig';
import {
  OBSCURA_AMM_ADDRESS,
  OBSCURA_RFQ_ADDRESS,
  arcTxUrl,
  arcAddressUrl,
  IS_DEPLOYED,
  IS_RFQ_DEPLOYED,
  STABLEFX_ESCROW_ADDRESS,
} from '../../config/arc';
import {
  FLUX_ASSETS,
  getAsset,
  isPairAllowed,
  isStablePair,
  QUOTE_ASSET,
} from '../../data/fluxAssets';
import { useTokenApproval } from '../../hooks/useTokenApproval';
import { useTokenBalance } from '../../hooks/useTokenBalance';
import { useAMMQuote } from '../../hooks/useAMMQuote';
import { useSmartRoute } from '../../hooks/useSmartRoute';
import { usePythSwap } from '../../hooks/usePythSwap';
import { usePythUpdater } from '../../hooks/usePythUpdater';
import { useEffectiveAccount } from '../../hooks/useEffectiveAccount';
import { useUnifiedSendTx } from '../../hooks/useUnifiedSendTx';
import { addActivity } from '../../lib/fluxMock';
import { isRfqAvailable, quoteRemainingMs } from '../../lib/rfqMaker';
import NanopayBadge from './NanopayBadge';

const G = {
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
    transition: 'border-color 0.2s',
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
  greenMid: 'var(--green-500)',
  dim: 'var(--text-dim)',
  secondary: 'var(--text-secondary)',
};

const availableAssets = FLUX_ASSETS.filter((a) => a.deployed).map((a) => a.symbol);

function TokenSelector({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', minWidth: 120 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#F0F0F0',
          padding: '12px 16px',
          borderRadius: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '1rem',
          fontWeight: 700,
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        {value}
        <span style={{ fontSize: '0.65rem', color: G.dim, marginLeft: 4 }}>▼</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            right: 0,
            background: 'rgba(10,10,15,0.98)',
            border: '1px solid var(--glass-border)',
            borderRadius: 12,
            zIndex: 100,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '11px 16px',
                background: opt === value ? 'rgba(61,158,78,0.1)' : 'transparent',
                border: 'none',
                color: opt === value ? G.green : G.secondary,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.92rem',
                fontWeight: opt === value ? 700 : 400,
                transition: 'background 0.15s',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SwapTab: React.FC = () => {
  const [fromAsset, setFromAsset] = useState('USDC');
  const [toAsset, setToAsset] = useState('GOLD');
  const [inputAmount, setInputAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [isCustomSlippage, setIsCustomSlippage] = useState(false);

  // Use the user's effective account: Circle Smart Account (passkey) takes
  // priority, with EOA as fallback. This is the single source of truth so
  // balance reads, approvals, and tx submission all target the right address.
  const { address, isConnected, source: accountSource } = useEffectiveAccount();
  const isPasskey = accountSource === 'circle';

  // Pyth-fresh path: every swap implicitly pushes a fresh Pyth update before
  // executing, so feeds never go stale during normal use. Works for both
  // EOA (wagmi) and passkey (Circle bundler) signers via the unified sender.
  // The Pyth fee (~$0.001 USDC) comes out of the user's wallet either way.
  const usePythFresh = true;

  const fromAssetData = getAsset(fromAsset);
  const toAssetData = getAsset(toAsset);

  const { formattedBalance: fromBalance } = useTokenBalance(
    fromAssetData?.contractAddress,
    address,
    fromAssetData?.decimals
  );
  const { formattedBalance: toBalance } = useTokenBalance(
    toAssetData?.contractAddress,
    address,
    toAssetData?.decimals
  );

  const ammQuote = useAMMQuote(
    fromAssetData?.contractAddress,
    toAssetData?.contractAddress,
    inputAmount || '0',
    fromAssetData?.decimals ?? 18,
    toAssetData?.decimals ?? 18,
    QUOTE_ASSET.contractAddress
  );

  // Smart router: ask the maker for a signed quote bounded by Pyth, fall
  // back to AMM when RFQ isn't available, doesn't beat the AMM rate, or the
  // trade size is below the RFQ threshold (default $1k for testing).
  const { quote: smartQuote, isFetching: isFetchingRfq } = useSmartRoute({
    taker: address,
    tokenIn: fromAssetData?.contractAddress as `0x${string}` | undefined,
    tokenOut: toAssetData?.contractAddress as `0x${string}` | undefined,
    tokenInSymbol: fromAsset,
    amountIn: inputAmount || '0',
    decimalsIn: fromAssetData?.decimals ?? 18,
    decimalsOut: toAssetData?.decimals ?? 18,
    ammAmountOut: ammQuote.amountOutBN as bigint | undefined,
    enabled: !!inputAmount && parseFloat(inputAmount || '0') > 0,
  });

  const amount = parseFloat(inputAmount) || 0;
  const useRFQ = smartQuote?.route === 'RFQ';
  const bestAmountOutBN: bigint =
    smartQuote?.amountOut ?? (ammQuote.amountOutBN as bigint | undefined) ?? 0n;
  const bestAmountOut = (() => {
    if (!toAssetData) return 0;
    return parseFloat(
      (Number(bestAmountOutBN) / 10 ** toAssetData.decimals).toFixed(8)
    );
  })();
  const routeType: 'AMM' | 'RFQ' = useRFQ ? 'RFQ' : 'AMM';
  const stableLeg = isStablePair(fromAsset, toAsset);

  const allowedToAssets = availableAssets.filter((s) => s !== fromAsset && isPairAllowed(fromAsset, s));

  // Approval target: AMM for AMM swaps, RFQ contract for RFQ settles.
  const approvalSpender = useRFQ ? OBSCURA_RFQ_ADDRESS : undefined; // undefined => AMM (default)

  const {
    needsApproval,
    handleApprove,
    isApprovePending,
    isApprovalConfirming,
    approvalHash,
  } = useTokenApproval(
    fromAssetData?.contractAddress,
    inputAmount,
    fromAssetData?.decimals ?? 18,
    approvalSpender
  );

  // Unified tx sender — picks Circle bundler when passkey is active, wagmi
  // otherwise. Returns a uniform `txHash` regardless.
  const unified = useUnifiedSendTx();

  const {
    executePythSwap,
    isPending: isPythPending,
    isConfirming: isPythConfirming,
    isSuccess: isPythSuccess,
    hash: pythHash,
  } = usePythSwap();

  // Standalone "wake up oracle" pusher used when the AMM quote returns 0
  // because Pyth feeds went stale. Reads the on-chain fee, fetches Hermes
  // updates, calls updatePriceFeeds — no swap involved.
  const {
    push: pushPyth,
    isPending: isPythUpdaterPending,
    isConfirming: isPythUpdaterConfirming,
    isSuccess: isPythUpdaterSuccess,
    error: pythUpdaterError,
  } = usePythUpdater();
  const isPythUpdating = isPythUpdaterPending || isPythUpdaterConfirming;

  // After a successful push, refetch the AMM quote so the user can swap.
  useEffect(() => {
    if (isPythUpdaterSuccess) {
      ammQuote.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPythUpdaterSuccess]);

  const activeHash = pythHash || unified.lastHash;
  const isAnyPending = unified.isPending || isPythPending;
  const isAnyConfirming = unified.isConfirming || isPythConfirming;
  const isAnyConfirmed = (unified.lastHash && !unified.isPending && !unified.isConfirming) || isPythSuccess;

  const handleFlip = () => {
    const tmp = fromAsset;
    setFromAsset(toAsset);
    setToAsset(tmp);
    setInputAmount('');
  };

  const handleExecuteSwap = async () => {
    if (!fromAssetData?.contractAddress || !toAssetData?.contractAddress || !inputAmount) return;

    // RFQ path: submit the maker-signed quote to ObscuraRFQ.settle().
    // Routes through `unified` so it works for both EOA and Passkey signers.
    if (useRFQ && smartQuote?.rfq) {
      const q = smartQuote.rfq;
      try {
        await unified.send({
          to: OBSCURA_RFQ_ADDRESS,
          abi: OBSCURA_RFQ_ABI,
          functionName: 'settle',
          args: [
            q.quoteId,
            q.maker,
            q.taker,
            q.tokenIn,
            q.tokenOut,
            q.amountIn,
            q.amountOut,
            q.expiry,
            q.signature,
          ],
        });
        addActivity({
          type: 'swap',
          description: `RFQ settled: ${inputAmount} ${fromAsset} → ${toAsset} via ${q.makerLabel}`,
          fromAsset,
          toAsset,
          amount,
        });
      } catch (e) {
        console.error('RFQ settle failed', e);
      }
      return;
    }

    // AMM path. Compute minAmountOut from the on-chain quote * (1 - slippage).
    const slipPct = Math.max(0, Math.min(50, parseFloat(slippage) || 0)) / 100;
    const minAmountOut =
      ammQuote.amountOutBN !== undefined
        ? ((ammQuote.amountOutBN as bigint) * BigInt(Math.floor((1 - slipPct) * 10_000))) / 10_000n
        : 0n;

    // Pyth-fresh path: only available for EOA signers because it carries
    // msg.value (Pyth update fee) which Circle's bundler doesn't forward
    // through user operations the way an EOA tx does.
    if (usePythFresh) {
      try {
        await executePythSwap({
          fromToken: fromAssetData.contractAddress as `0x${string}`,
          toToken: toAssetData.contractAddress as `0x${string}`,
          fromSymbol: fromAsset,
          toSymbol: toAsset,
          amountIn: inputAmount,
          decimalsIn: fromAssetData.decimals,
          minAmountOut,
        });
        addActivity({
          type: 'swap',
          description: `Swapped ${inputAmount} ${fromAsset} to ${toAsset} (Pyth-fresh AMM)`,
          fromAsset,
          toAsset,
          amount,
        });
      } catch (e) {
        console.error('Pyth swap failed', e);
      }
      return;
    }

    // Plain AMM swap, routed through the unified sender so passkey-signed
    // smart accounts settle as a gasless user operation.
    try {
      await unified.send({
        to: OBSCURA_AMM_ADDRESS,
        abi: OBSCURA_AMM_ABI,
        functionName: 'swap',
        args: [
          fromAssetData.contractAddress as `0x${string}`,
          toAssetData.contractAddress as `0x${string}`,
          parseUnits(inputAmount, fromAssetData.decimals),
          minAmountOut,
        ],
      });
      addActivity({
        type: 'swap',
        description: `Swapped ${inputAmount} ${fromAsset} to ${toAsset} (AMM${isPasskey ? ' · gasless' : ''})`,
        fromAsset,
        toAsset,
        amount,
      });
    } catch (e) {
      console.error('AMM swap failed', e);
    }
  };

  useEffect(() => {
    if (isAnyConfirmed) setInputAmount('');
  }, [isAnyConfirmed]);

  const btnStyle = (variant: 'primary' | 'secondary' | 'ghost'): React.CSSProperties => ({
    width: '100%',
    padding: '15px',
    borderRadius: 12,
    fontWeight: 700,
    fontSize: '0.88rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all 0.25s',
    border: '1px solid',
    ...(variant === 'primary'
      ? {
          background: 'rgba(61,158,78,0.15)',
          borderColor: 'var(--green-600)',
          color: 'var(--green-200)',
        }
      : variant === 'secondary'
      ? {
          background: 'transparent',
          borderColor: 'rgba(255,255,255,0.12)',
          color: G.secondary,
        }
      : {
          background: 'rgba(255,255,255,0.04)',
          borderColor: 'rgba(255,255,255,0.06)',
          color: G.dim,
        }),
  });

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#F0F0F0', margin: 0 }}>
          Swap
        </h2>
        <div
          style={{
            fontSize: '0.75rem',
            color: G.dim,
            marginTop: 4,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Hybrid AMM + RFQ routing on Arc Testnet
        </div>
      </div>

      {!IS_DEPLOYED && (
        <div
          style={{
            ...G.card,
            marginBottom: 16,
            borderColor: 'rgba(255,170,80,0.3)',
            background: 'rgba(255,170,80,0.05)',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: '#FFCC88', fontWeight: 700, marginBottom: 6 }}>
            Contracts not deployed yet
          </div>
          <div style={{ fontSize: '0.78rem', color: G.dim, lineHeight: 1.6 }}>
            Run <code style={{ color: G.green }}>npm run deploy:arc</code> followed by{' '}
            <code style={{ color: G.green }}>npm run seed:arc</code> to enable on-chain swaps. Until
            then the UI will render quotes against zero reserves.
          </div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={G.card}>
        <NanopayBadge />
        <div style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={G.label}>From</span>
            <span style={{ fontSize: '0.75rem', color: G.dim }}>
              Balance <span style={{ color: G.green }}>{fromBalance.toFixed(4)}</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <input
              type="number"
              placeholder="0.00"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              style={{ ...G.input, flex: 1, paddingRight: 12 }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--green-600)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
            />
            <TokenSelector
              value={fromAsset}
              options={availableAssets}
              onChange={(v) => {
                setFromAsset(v);
                if (v === toAsset) setToAsset(availableAssets.find((a) => a !== v) || 'GOLD');
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '-2px 0', position: 'relative', zIndex: 2 }}>
          <button
            onClick={handleFlip}
            style={{
              background: 'rgba(13,13,18,0.95)',
              border: '1px solid rgba(61,158,78,0.3)',
              color: 'var(--green-400)',
              width: 42,
              height: 42,
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              transition: 'all 0.3s',
            }}
          >
            ⇅
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={G.label}>To (estimated)</span>
            <span style={{ fontSize: '0.75rem', color: G.dim }}>
              Balance <span style={{ color: G.green }}>{toBalance.toFixed(4)}</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <input
              type="text"
              placeholder="0.00"
              readOnly
              value={bestAmountOut > 0 ? bestAmountOut.toFixed(6) : ''}
              style={{ ...G.input, flex: 1, color: G.green, paddingRight: 12 }}
            />
            <TokenSelector value={toAsset} options={allowedToAssets} onChange={setToAsset} />
          </div>
        </div>

        {amount > 0 && bestAmountOut > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{
              background: useRFQ
                ? 'rgba(157,78,221,0.06)'
                : 'rgba(61,158,78,0.05)',
              border: `1px solid ${useRFQ ? 'rgba(157,78,221,0.25)' : 'rgba(61,158,78,0.15)'}`,
              borderRadius: 12,
              padding: '16px 18px',
              marginBottom: 16,
            }}
          >
            {[
              {
                label: 'Routing',
                value: useRFQ
                  ? `RFQ · ${smartQuote?.rfq?.makerLabel ?? 'Maker'}`
                  : 'AMM (Pyth-priced)',
                color: useRFQ ? 'var(--neon-purple)' : G.green,
              },
              {
                label: 'Best quote',
                value: `${bestAmountOut.toFixed(6)} ${toAsset}`,
                color: '#F0F0F0',
              },
              {
                label: 'Price source',
                value: useRFQ ? 'Maker (Pyth-bounded ±2%)' : 'Pyth Network (oracle)',
                color: useRFQ ? 'var(--neon-purple)' : G.green,
              },
              {
                label: useRFQ ? 'Maker fee' : 'Pool fee',
                value: useRFQ ? '~0.05%' : '0.30%',
                color: G.dim,
              },
              !useRFQ && {
                label: 'Pool depth used',
                value: `${ammQuote.inventoryUtilization.toFixed(2)}%`,
                color: ammQuote.inventoryUtilization > 30 ? '#FF5577' : G.green,
              },
              useRFQ &&
                smartQuote?.rfq && {
                  label: 'Quote expires',
                  value: `${Math.max(0, Math.floor(quoteRemainingMs(smartQuote.rfq) / 1000))}s`,
                  color: G.dim,
                },
              { label: 'Gas token', value: 'USDC (Arc native)', color: G.dim },
            ]
              .filter(Boolean)
              .map((row: any) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem',
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: G.dim }}>{row.label}</span>
                  <span style={{ color: row.color, fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}

            {/* Why-we-chose-this-route explainer */}
            {!useRFQ && smartQuote?.rfqSkipReason && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.72rem',
                  color: G.dim,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: 'var(--green-300)', fontWeight: 700 }}>
                  Routing decision:
                </span>{' '}
                {smartQuote.rfqSkipReason}.
                {smartQuote.tradeUsd > 0 && (
                  <>
                    {' '}
                    Trade ≈ <strong style={{ color: '#F0F0F0' }}>${smartQuote.tradeUsd.toFixed(2)}</strong>
                    {' · '}
                    RFQ engages at <strong style={{ color: '#F0F0F0' }}>${smartQuote.rfqMinUsd.toLocaleString()}</strong>
                  </>
                )}
              </div>
            )}
            {isFetchingRfq && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: '0.7rem',
                  color: 'var(--neon-purple)',
                }}
              >
                Asking maker pool for signed quotes…
              </div>
            )}
          </motion.div>
        )}

        {/* Stable-pair: highlight FxEscrow compatibility narrative */}
        {stableLeg && (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(95,191,255,0.06)',
              border: '1px solid rgba(95,191,255,0.25)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div style={{ fontSize: '0.74rem', flex: 1, lineHeight: 1.5 }}>
              <div style={{ color: '#5FBFFF', fontWeight: 700, marginBottom: 2 }}>
                Stablecoin FX pair detected
              </div>
              <div style={{ color: G.dim }}>
                Compatible with Circle's{' '}
                <a
                  href={arcAddressUrl(STABLEFX_ESCROW_ADDRESS)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#5FBFFF', textDecoration: 'underline' }}
                >
                  StableFX FxEscrow
                </a>{' '}
                for institutional settlement. Obscura settles via the same
                oracle-bounded RFQ flow with sub-second finality on Arc.
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={G.label}>Slippage tolerance</span>
            <span style={{ fontSize: '0.78rem', color: G.green, fontWeight: 600 }}>{slippage}%</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['0.1', '0.5', '1.0'].map((val) => (
              <button
                key={val}
                onClick={() => {
                  setSlippage(val);
                  setIsCustomSlippage(false);
                }}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: !isCustomSlippage && slippage === val ? 'rgba(61,158,78,0.12)' : 'transparent',
                  border: `1px solid ${!isCustomSlippage && slippage === val ? 'var(--green-600)' : 'rgba(255,255,255,0.08)'}`,
                  color: !isCustomSlippage && slippage === val ? G.green : G.dim,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >
                {val}%
              </button>
            ))}
            {isCustomSlippage ? (
              <input
                autoFocus
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                placeholder="Custom"
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: 8,
                  background: 'rgba(61,158,78,0.08)',
                  border: '1px solid var(--green-600)',
                  color: G.green,
                  fontSize: '0.82rem',
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
            ) : (
              <button
                onClick={() => {
                  setIsCustomSlippage(true);
                  setSlippage('');
                }}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: G.dim,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                Custom
              </button>
            )}
          </div>
        </div>

        {!isConnected ? (
          <button style={{ ...btnStyle('ghost'), cursor: 'not-allowed', opacity: 0.5 }} disabled>
            Connect wallet to swap
          </button>
        ) : !ammQuote.hasLiquidity && amount > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              style={{ ...btnStyle('ghost'), cursor: 'not-allowed', borderColor: 'rgba(255,170,80,0.4)', color: '#FFC454' }}
              disabled
            >
              Pyth oracle stale
            </button>
            <button
              onClick={async () => {
                const tx = await pushPyth();
                if (tx) {
                  // Refetch the AMM quote after the push confirms.
                  setTimeout(() => ammQuote.refetch(), 2000);
                }
              }}
              disabled={isPythUpdating}
              style={{
                ...btnStyle('primary'),
                background: 'rgba(230,201,121,0.12)',
                borderColor: '#E6C979',
                color: '#FFD86B',
                opacity: isPythUpdating ? 0.6 : 1,
              }}
            >
              {isPythUpdating ? 'Waking up oracle…' : 'Wake up Pyth oracle (one-click)'}
            </button>
            <div style={{ fontSize: '0.7rem', color: G.dim, textAlign: 'center', lineHeight: 1.5 }}>
              {pythUpdaterError ? (
                <span style={{ color: '#FF7777' }}>{pythUpdaterError}</span>
              ) : (
                'Quote is zero because no one has pushed Pyth prices to Arc recently. Click above to fetch fresh prices from Hermes and push them on-chain. ~$0.001 in USDC gas.'
              )}
            </div>
          </div>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isApprovePending || isApprovalConfirming}
            style={{ ...btnStyle('primary'), opacity: isApprovePending || isApprovalConfirming ? 0.6 : 1 }}
          >
            {isApprovePending || isApprovalConfirming ? 'Approving...' : `Approve ${fromAsset}`}
          </button>
        ) : (
          <button
            onClick={handleExecuteSwap}
            disabled={!amount || isAnyPending || isAnyConfirming}
            style={{ ...btnStyle('primary'), opacity: !amount || isAnyPending || isAnyConfirming ? 0.6 : 1 }}
          >
            {isAnyPending
              ? isPasskey
                ? 'Approving with passkey…'
                : 'Confirming in wallet…'
              : isAnyConfirming
              ? 'Settling on Arc…'
              : usePythFresh
              ? `Execute swap${isPasskey ? ' (gasless)' : ' (Pyth-fresh)'}`
              : 'Execute swap'}
          </button>
        )}

        {approvalHash && (
          <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.75rem', color: G.dim }}>
            Approval tx:{' '}
            <a
              href={arcTxUrl(approvalHash)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: G.green }}
            >
              View on ArcScan
            </a>
          </div>
        )}
        {unified.error && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255,85,119,0.08)',
              border: '1px solid rgba(255,85,119,0.25)',
              color: '#FFB0BD',
              fontSize: '0.75rem',
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: '#FF8898' }}>Last tx error:</strong> {unified.error}
            {isPasskey && (
              <div style={{ marginTop: 6, color: G.dim }}>
                Tip: smart account needs USDC funded to cover Pyth fee + swap amount.
                Faucet: https://faucet.circle.com (paste your passkey address).
              </div>
            )}
          </div>
        )}
        {unified.lastHash && unified.lastSource && (
          <div style={{ marginTop: 6, textAlign: 'center', fontSize: '0.75rem', color: G.dim }}>
            {unified.lastSource === 'circle' ? 'Gasless tx' : 'Swap tx'}:{' '}
            <a
              href={arcTxUrl(unified.lastHash)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: G.green }}
            >
              View on ArcScan
            </a>
          </div>
        )}
        {pythHash && (
          <div style={{ marginTop: 6, textAlign: 'center', fontSize: '0.75rem', color: G.dim }}>
            Pyth-fresh swap tx:{' '}
            <a
              href={arcTxUrl(pythHash)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: G.green }}
            >
              View on ArcScan
            </a>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SwapTab;
