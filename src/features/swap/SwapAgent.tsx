import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, keccak256, stringToHex } from 'viem';
import { useEffectiveAccount } from '../../hooks/useEffectiveAccount';
import {
    parseSwapIntent,
    ParseResult,
    SwapIntent,
    ShieldIntent,
    ConditionalIntent,
    LiquidityIntent,
} from '../../lib/parseSwapIntent';
import { getAsset, isPairAllowed, FLUX_ASSETS } from '../../data/fluxAssets';
import { OBSCURA_AMM_ABI } from '../../config/dexConfig';
import { OBSCURA_AMM_ADDRESS, OBSCURA_SHIELD_ADDRESS, RFQ_MAKER_ADDRESS, arcTxUrl } from '../../config/arc';
import { SHIELD_ABI, PRIVACY_LEVELS, PrivacyLevel } from '../../config/shieldConfig';
import { useTokenApproval } from '../../hooks/useTokenApproval';
import { addActivity } from '../../lib/fluxMock';
import { fetchAssetPrice } from '../../lib/priceOracle';
import { chargeLlmParse, chargeRfqQuote, isNanopayConfigured } from '../../lib/nanopayClient';

interface ChatMessage {
    role: 'user' | 'agent';
    content: string;
    showConfirm?: boolean;
    txHash?: string;
}

type AgentStep = 'idle' | 'approving' | 'executing' | 'watching';

type PendingAction =
    | { type: 'swap'; intent: SwapIntent }
    | { type: 'shield'; intent: ShieldIntent }
    | { type: 'conditional'; intent: ConditionalIntent }
    | null;

const SwapAgent: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: 'agent',
            content:
                "Hi! I'm your Obscura Shadow Layer agent. I can:\n\n" +
                '🔄 swap 5 USDC to GOLD\n' +
                '🔒 shield 10 USDC at high privacy\n' +
                '💧 add liquidity 1 GOLD + 4500 USDC\n' +
                '📊 analisa market GOLD\n' +
                '⏰ buy GOLD with 50 USDC if GOLD drops 5%\n' +
                '👤 cek portfolio',
        },
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<AgentStep>('idle');
    const [pending, setPending] = useState<PendingAction>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const watcherRef = useRef<number | null>(null);

    const { address, isConnected } = useEffectiveAccount();

    // Approval target derived from the immediate (non-conditional) action.
    const immediateAction =
        pending?.type === 'conditional' ? pending.intent.action : pending;

    const approvalTokenAddress =
        immediateAction?.type === 'swap' || (immediateAction as any)?.kind === 'swap'
            ? getAsset(
                  immediateAction?.type === 'swap'
                      ? (immediateAction as any).intent.from
                      : (immediateAction as any).intent.from
              )?.contractAddress
            : immediateAction?.type === 'shield' || (immediateAction as any)?.kind === 'shield'
            ? getAsset(
                  immediateAction?.type === 'shield'
                      ? (immediateAction as any).intent.token
                      : (immediateAction as any).intent.token
              )?.contractAddress
            : undefined;

    const approvalAmount =
        immediateAction?.type === 'swap'
            ? immediateAction.intent.amount.toString()
            : immediateAction?.type === 'shield'
            ? immediateAction.intent.amount.toString()
            : (immediateAction as any)?.kind === 'swap'
            ? (immediateAction as any).intent.amount.toString()
            : (immediateAction as any)?.kind === 'shield'
            ? (immediateAction as any).intent.amount.toString()
            : '';

    const approvalDecimals =
        immediateAction?.type === 'swap'
            ? getAsset(immediateAction.intent.from)?.decimals ?? 18
            : immediateAction?.type === 'shield'
            ? getAsset(immediateAction.intent.token)?.decimals ?? 18
            : 18;

    const isShieldAction =
        immediateAction?.type === 'shield' || (immediateAction as any)?.kind === 'shield';

    const approvalSpender = isShieldAction
        ? (OBSCURA_SHIELD_ADDRESS as `0x${string}`)
        : (OBSCURA_AMM_ADDRESS as `0x${string}`);

    const {
        needsApproval,
        handleApprove,
        isApprovalConfirmed,
        approveError,
    } = useTokenApproval(approvalTokenAddress, approvalAmount, approvalDecimals, approvalSpender);

    // Two write contracts so swap/shield txs don't clobber each other.
    const {
        writeContract: executeSwap,
        data: swapTxHash,
        error: swapWriteError,
    } = useWriteContract();
    const { isSuccess: isSwapConfirmed } = useWaitForTransactionReceipt({ hash: swapTxHash });

    const {
        writeContract: executeShield,
        data: shieldTxHash,
        error: shieldWriteError,
    } = useWriteContract();
    const { isSuccess: isShieldConfirmed } = useWaitForTransactionReceipt({ hash: shieldTxHash });

    const addMsg = (content: string, extra?: Partial<ChatMessage>) => {
        setMessages((prev) => [...prev, { role: 'agent', content, ...extra }]);
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ---------- Approval -> action chaining ----------
    useEffect(() => {
        if (!isApprovalConfirmed || step !== 'approving' || !pending) return;

        // For conditional intents we don't execute on approval — the watcher
        // does that when the price condition triggers.
        if (pending.type === 'conditional') {
            setStep('watching');
            addMsg('Approval confirmed. Watching price condition…');
            return;
        }

        if (pending.type === 'swap') {
            setStep('executing');
            addMsg('Approved. Executing swap — confirm in your wallet.');
            triggerSwap(pending.intent);
        } else if (pending.type === 'shield') {
            setStep('executing');
            addMsg(`Approved. Executing ${pending.intent.action}…`);
            if (pending.intent.action === 'shield') triggerShield(pending.intent);
            // unshield doesn't need approval; this branch is unlikely.
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isApprovalConfirmed]);

    // ---------- Errors ----------
    useEffect(() => {
        if (approveError && step === 'approving') {
            addMsg('Approval rejected or failed. You can try again.');
            setStep('idle');
        }
    }, [approveError, step]);

    useEffect(() => {
        if (swapWriteError && step === 'executing') {
            addMsg('Swap rejected or failed. You can try again.');
            setStep('idle');
        }
    }, [swapWriteError, step]);

    useEffect(() => {
        if (shieldWriteError && step === 'executing') {
            addMsg('Transaction rejected or failed. You can try again.');
            setStep('idle');
        }
    }, [shieldWriteError, step]);

    // ---------- Confirmations ----------
    useEffect(() => {
        if (!isSwapConfirmed || !pending) return;
        const swap = pending.type === 'swap' ? pending.intent : null;
        if (!swap) return;
        addMsg(
            `Swap complete. ${swap.amount} ${swap.from} → ${swap.to}. View on ArcScan.`,
            { txHash: swapTxHash as string }
        );
        addActivity({
            type: 'swap',
            description: `AI Agent swap ${swap.amount} ${swap.from} → ${swap.to}`,
            fromAsset: swap.from,
            toAsset: swap.to,
            amount: swap.amount,
        });
        setPending(null);
        setStep('idle');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSwapConfirmed]);

    useEffect(() => {
        if (!isShieldConfirmed || !pending || pending.type !== 'shield') return;
        const verb = pending.intent.action === 'shield' ? 'Shielded' : 'Unshielded';
        addMsg(`${verb} ${pending.intent.amount} ${pending.intent.token}.`, {
            txHash: shieldTxHash as string,
        });
        addActivity({
            type: pending.intent.action,
            description: `AI Agent ${verb.toLowerCase()} ${pending.intent.amount} ${pending.intent.token}`,
            fromAsset: pending.intent.token,
            amount: pending.intent.amount,
        });
        setPending(null);
        setStep('idle');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isShieldConfirmed]);

    // ---------- Conditional watcher ----------
    useEffect(() => {
        if (step !== 'watching' || !pending || pending.type !== 'conditional') return;

        const cond = pending.intent.condition;
        // Capture the entry price for percentage conditions.
        let entryPrice: number | null = null;

        const tick = async () => {
            try {
                const price = await fetchAssetPrice(cond.asset);
                if (entryPrice === null) entryPrice = price;

                let triggered = false;
                if (cond.op === 'gt') triggered = price > cond.value;
                else if (cond.op === 'lt') triggered = price < cond.value;
                else if (cond.op === 'pct_drop') {
                    const dropPct = ((entryPrice - price) / entryPrice) * 100;
                    triggered = dropPct >= cond.value;
                } else if (cond.op === 'pct_rise') {
                    const risePct = ((price - entryPrice) / entryPrice) * 100;
                    triggered = risePct >= cond.value;
                }

                if (triggered) {
                    if (watcherRef.current !== null) {
                        window.clearInterval(watcherRef.current);
                        watcherRef.current = null;
                    }
                    addMsg(
                        `Condition met (${cond.asset} = ${price.toFixed(4)}). Executing action…`
                    );
                    setStep('executing');
                    const action = (pending as any).intent.action;
                    if (action.kind === 'swap') triggerSwap(action.intent);
                    else if (action.kind === 'shield') triggerShield(action.intent);
                }
            } catch (e) {
                console.error('[agent watcher] price fetch failed', e);
            }
        };

        // First tick immediately, then poll every 30s.
        tick();
        watcherRef.current = window.setInterval(tick, 30_000);

        return () => {
            if (watcherRef.current !== null) {
                window.clearInterval(watcherRef.current);
                watcherRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, pending]);

    // ---------- Action triggers ----------
    function triggerSwap(intent: SwapIntent) {
        const from = getAsset(intent.from);
        const to = getAsset(intent.to);
        if (!from?.contractAddress || !to?.contractAddress) {
            addMsg(`Cannot resolve contract addresses for ${intent.from}/${intent.to}.`);
            setStep('idle');
            return;
        }
        executeSwap({
            address: OBSCURA_AMM_ADDRESS,
            abi: OBSCURA_AMM_ABI,
            functionName: 'swap',
            args: [
                from.contractAddress as `0x${string}`,
                to.contractAddress as `0x${string}`,
                parseUnits(intent.amount.toString(), from.decimals),
                0n,
            ],
        });
    }

    function triggerShield(intent: ShieldIntent) {
        const asset = getAsset(intent.token);
        if (!asset?.contractAddress) {
            addMsg(`Cannot resolve contract address for ${intent.token}.`);
            setStep('idle');
            return;
        }
        const level = intent.level ?? PrivacyLevel.MEDIUM;
        const salt = keccak256(stringToHex(`obscura:agent:${address}:${Date.now()}`));

        if (intent.action === 'shield') {
            executeShield({
                address: OBSCURA_SHIELD_ADDRESS,
                abi: SHIELD_ABI,
                functionName: 'shield',
                args: [
                    asset.contractAddress as `0x${string}`,
                    parseUnits(intent.amount.toString(), asset.decimals),
                    level,
                    salt,
                ],
            });
        } else {
            // Unshield: assume the user wants the most recent active entry.
            // The Shield tab UI gives finer-grained control.
            addMsg(
                'Unshield via the Shield tab to pick a specific entry. Falling back to entry #0…'
            );
            executeShield({
                address: OBSCURA_SHIELD_ADDRESS,
                abi: SHIELD_ABI,
                functionName: 'unshield',
                args: [asset.contractAddress as `0x${string}`, 0n, salt],
            });
        }
    }

    // ---------- Confirm button ----------
    const handleConfirm = () => {
        if (!pending) return;

        const isUnshield =
            pending.type === 'shield' && pending.intent.action === 'unshield';

        if (!isUnshield && needsApproval) {
            setStep('approving');
            const tokenName =
                pending.type === 'swap'
                    ? pending.intent.from
                    : pending.type === 'shield'
                    ? pending.intent.token
                    : pending.intent.action.kind === 'swap'
                    ? pending.intent.action.intent.from
                    : pending.intent.action.intent.token;
            addMsg(`Approving ${tokenName}… confirm in your wallet.`);
            handleApprove();
            return;
        }

        if (pending.type === 'conditional') {
            setStep('watching');
            const c = pending.intent.condition;
            addMsg(
                `Watching ${c.asset} for ${describeCondition(c)}. I'll execute when triggered.`
            );
            return;
        }

        setStep('executing');
        if (pending.type === 'swap') triggerSwap(pending.intent);
        else if (pending.type === 'shield') triggerShield(pending.intent);
    };

    const handleSend = async () => {
        const msg = input.trim();
        if (!msg) return;

        setMessages((prev) => [...prev, { role: 'user', content: msg }]);
        setInput('');
        setIsLoading(true);

        if (!isConnected) {
            addMsg('Please connect your wallet first.');
            setIsLoading(false);
            return;
        }

        try {
            const result: ParseResult = await parseSwapIntent(msg);

            // Nanopay billing: charge for the LLM parse (or regex parse).
            // Fire-and-forget so it doesn't block the UX.
            if (address && isNanopayConfigured() && RFQ_MAKER_ADDRESS !== '0x0000000000000000000000000000000000000000') {
                chargeLlmParse(address, RFQ_MAKER_ADDRESS as `0x${string}`).catch(() => {});
            }

            if (!result.success) {
                addMsg(
                    "I couldn't parse that. Try one of:\n" +
                        '• "swap 10 USDC to GOLD"\n' +
                        '• "shield 5 USDC at high privacy"\n' +
                        '• "add liquidity 1 GOLD + 4500 USDC"\n' +
                        '• "analisa market GOLD"\n' +
                        '• "buy GOLD with 50 USDC if GOLD drops 5%"\n' +
                        '• "cek portfolio"'
                );
                setIsLoading(false);
                return;
            }

            if (result.type === 'insight') {
                // Market insight: fetch live price + show analysis.
                const asset = result.asset;
                let priceLine = '';
                let suggestion = '';
                if (asset) {
                    try {
                        const price = await fetchAssetPrice(asset);
                        const fmt =
                            price >= 1
                                ? price.toFixed(2)
                                : price >= 0.01
                                ? price.toFixed(4)
                                : price.toFixed(6);
                        priceLine = `📊 ${asset} live oracle price: $${fmt}\n   (sourced from Pyth Network on Arc)\n\n`;

                        // Inline auto-insight if LLM didn't provide one.
                        if (!result.text) {
                            const meta = getAsset(asset);
                            const desc =
                                asset === 'USDC'
                                    ? 'USDC is the native gas + quote token on Arc. Always pegged to $1.'
                                    : asset === 'EURC'
                                    ? 'EURC is the Euro stablecoin native to Arc, mirroring EUR/USD via Pyth.'
                                    : asset === 'JPYC'
                                    ? 'JPYC is a mock Japanese Yen token. Pyth USD/JPY feed is inverted to derive USD per JPY.'
                                    : asset === 'GOLD'
                                    ? 'GOLD is a mock tokenized gold position priced via Pyth XAU/USD feed.'
                                    : asset === 'AAPL'
                                    ? 'AAPL is a mock equity token tracking Apple via Pyth equity feeds.'
                                    : asset === 'MSTR'
                                    ? 'MSTR is a mock equity token tracking MicroStrategy via Pyth.'
                                    : `${asset} is tracked by an Obscura mock contract on Arc.`;
                            suggestion =
                                `${desc}\n\n` +
                                `Try:\n` +
                                `• "swap 5 USDC to ${asset}" to take a position\n` +
                                (asset !== 'USDC'
                                    ? `• "shield 1 ${asset} at high privacy" to hide your exposure\n`
                                    : '') +
                                `• "buy ${asset} with 50 USDC if ${asset} drops 5%" to set up a conditional`;
                        }
                    } catch {
                        priceLine = `📊 ${asset}: live price unavailable. Check Pyth Hermes connectivity.\n\n`;
                    }
                }
                const text = [priceLine, result.text, suggestion].filter(Boolean).join('').trim();
                addMsg(text || `No insight available for ${asset}.`);
            } else if (result.type === 'liquidity') {
                const li = result.liquidityIntent;
                if (li.action === 'add') {
                    addMsg(
                        `Preview: Add liquidity\n` +
                            `• ${li.amountAsset} ${li.asset} + ${li.amountUSDC} USDC\n` +
                            `• Pool: ${li.asset}/USDC on ObscuraAMM\n\n` +
                            `Open the Liquidity tab to execute this. (Agent-driven liquidity coming soon.)`
                    );
                } else {
                    addMsg(
                        `Preview: Remove liquidity from ${li.asset}/USDC pool.\n\n` +
                            `Open the Liquidity tab to execute this.`
                    );
                }
            } else if (result.type === 'portfolio') {
                const tokenList = FLUX_ASSETS.map((a) => `• ${a.symbol} — ${a.name}`).join('\n');
                addMsg(
                    `Portfolio for ${address?.slice(0, 6)}…${address?.slice(-4)} on Arc Testnet.\n\nTracked tokens:\n${tokenList}\n\nOpen the Portfolio tab for live balances.`
                );
            } else if (result.type === 'shield') {
                const i = result.shieldIntent;
                if (!getAsset(i.token)?.deployed) {
                    addMsg(`${i.token} is not deployed yet on Arc Testnet. Run \`npm run deploy:arc\`.`);
                    setIsLoading(false);
                    return;
                }
                setPending({ type: 'shield', intent: i });
                const lvlMeta = i.level !== undefined ? PRIVACY_LEVELS[i.level] : PRIVACY_LEVELS[PrivacyLevel.MEDIUM];
                addMsg(
                    `Preview: ${i.action} ${i.amount} ${i.token} (parsed via ${result.source})\n` +
                        `• Privacy level: ${lvlMeta.label} — ${lvlMeta.description}\n` +
                        `\nReady to execute?`,
                    { showConfirm: true }
                );
            } else if (result.type === 'swap') {
                const i = result.intent;
                if (!isPairAllowed(i.from, i.to)) {
                    addMsg(
                        `Pair ${i.from}/${i.to} is not available. Available: ${FLUX_ASSETS.map((a) => a.symbol).join(', ')}`
                    );
                    setIsLoading(false);
                    return;
                }
                setPending({ type: 'swap', intent: i });
                addMsg(
                    `Preview swap (parsed via ${result.source})\n` +
                        `• ${i.amount} ${i.from} → ${i.to}\n` +
                        `• Router: ObscuraAMM (USDC-quoted)\n` +
                        `\nReady to execute?`,
                    { showConfirm: true }
                );
            } else if (result.type === 'conditional') {
                setPending({ type: 'conditional', intent: result.conditional });
                const c = result.conditional;
                const actionDesc =
                    c.action.kind === 'swap'
                        ? `swap ${c.action.intent.amount} ${c.action.intent.from} → ${c.action.intent.to}`
                        : `${c.action.intent.action} ${c.action.intent.amount} ${c.action.intent.token}`;
                addMsg(
                    `Conditional intent (parsed via ${result.source})\n` +
                        `• When: ${c.condition.asset} ${describeCondition(c.condition)}\n` +
                        `• Then: ${actionDesc}\n\n` +
                        `Confirm to start watching. I'll execute the moment the condition triggers.`,
                    { showConfirm: true }
                );
            }
        } catch (err: any) {
            addMsg(`Error: ${err.message}`);
        }

        setIsLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isProcessing = step === 'approving' || step === 'executing' || step === 'watching';

    return (
        <>
            <motion.button
                onClick={() => {
                    setIsOpen(!isOpen);
                    setTimeout(() => inputRef.current?.focus(), 100);
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                    position: 'fixed',
                    bottom: '30px',
                    right: '30px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(61,158,78,0.15)',
                    border: '2px solid var(--green-600)',
                    color: 'white',
                    fontSize: '1.4rem',
                    cursor: 'pointer',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(61,158,78,0.3)',
                    backdropFilter: 'blur(10px)',
                }}
            >
                {isOpen ? '✕' : 'AI'}
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            position: 'fixed',
                            bottom: '100px',
                            right: '30px',
                            width: '380px',
                            maxHeight: '520px',
                            background: 'rgba(10,10,15,0.97)',
                            border: '1px solid rgba(61,158,78,0.2)',
                            borderRadius: '16px',
                            zIndex: 999,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 0 30px rgba(61,158,78,0.1), 0 20px 60px rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(20px)',
                        }}
                    >
                        <div
                            style={{
                                padding: '14px 18px',
                                borderBottom: '1px solid rgba(61,158,78,0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontFamily: 'Inter, system-ui',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        color: 'var(--green-300)',
                                    }}
                                >
                                    OBSCURA INTENT AGENT
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                    Swap · Shield · Conditional
                                </div>
                            </div>
                            <div
                                style={{
                                    marginLeft: 'auto',
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    background: isConnected ? 'var(--green-400)' : '#FF4444',
                                    boxShadow: isConnected ? '0 0 6px var(--green-400)' : '0 0 6px #FF4444',
                                }}
                            />
                        </div>

                        <div
                            className="agent-chat-messages"
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '15px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                maxHeight: '380px',
                                scrollbarWidth: 'none',
                            }}
                        >
                            {messages.map((msg, i) => (
                                <div
                                    key={i}
                                    style={{
                                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                        maxWidth: '85%',
                                    }}
                                >
                                    <div
                                        style={{
                                            background:
                                                msg.role === 'user'
                                                    ? 'rgba(61,158,78,0.1)'
                                                    : 'rgba(157,78,221,0.08)',
                                            border: `1px solid ${
                                                msg.role === 'user'
                                                    ? 'rgba(61,158,78,0.25)'
                                                    : 'rgba(157,78,221,0.15)'
                                            }`,
                                            borderRadius:
                                                msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                                            padding: '10px 14px',
                                            fontSize: '0.85rem',
                                            color: 'rgba(255,255,255,0.9)',
                                            lineHeight: '1.5',
                                            whiteSpace: 'pre-wrap',
                                        }}
                                    >
                                        {msg.content}
                                        {msg.txHash && (
                                            <div style={{ marginTop: '8px' }}>
                                                <a
                                                    href={arcTxUrl(msg.txHash)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        color: 'var(--green-400)',
                                                        textDecoration: 'underline',
                                                        fontSize: '0.78rem',
                                                    }}
                                                >
                                                    View on ArcScan
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    {msg.showConfirm && pending && step === 'idle' && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            <button
                                                onClick={handleConfirm}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px 12px',
                                                    background: 'rgba(0,255,136,0.15)',
                                                    border: '1px solid #00FF88',
                                                    borderRadius: '8px',
                                                    color: '#00FF88',
                                                    cursor: 'pointer',
                                                    fontFamily: 'JetBrains Mono',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold',
                                                }}
                                            >
                                                CONFIRM
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPending(null);
                                                    addMsg('Cancelled. What else would you like to do?');
                                                }}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px 12px',
                                                    background: 'rgba(255,68,68,0.1)',
                                                    border: '1px solid rgba(255,68,68,0.4)',
                                                    borderRadius: '8px',
                                                    color: '#FF4444',
                                                    cursor: 'pointer',
                                                    fontFamily: 'JetBrains Mono',
                                                    fontSize: '0.8rem',
                                                }}
                                            >
                                                CANCEL
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isLoading && (
                                <div
                                    style={{
                                        alignSelf: 'flex-start',
                                        background: 'rgba(138,43,226,0.1)',
                                        border: '1px solid rgba(138,43,226,0.2)',
                                        borderRadius: '12px 12px 12px 4px',
                                        padding: '10px 14px',
                                        color: 'var(--neon-purple)',
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    Parsing…
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div
                            style={{
                                padding: '11px 15px',
                                borderTop: '1px solid rgba(61,158,78,0.12)',
                                display: 'flex',
                                gap: '10px',
                            }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="swap, shield, conditional…"
                                disabled={isLoading || isProcessing}
                                style={{
                                    flex: 1,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    fontFamily: 'JetBrains Mono',
                                    outline: 'none',
                                }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={isLoading || isProcessing || !input.trim()}
                                style={{
                                    background: 'rgba(61,158,78,0.1)',
                                    border: '1px solid var(--green-600)',
                                    borderRadius: '8px',
                                    padding: '9px 14px',
                                    color: 'var(--green-300)',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    opacity: isLoading || !input.trim() ? 0.5 : 1,
                                }}
                            >
                                →
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

function describeCondition(c: { op: string; value: number; asset: string }) {
    if (c.op === 'gt') return `> ${c.value}`;
    if (c.op === 'lt') return `< ${c.value}`;
    if (c.op === 'pct_drop') return `drops ${c.value}%`;
    if (c.op === 'pct_rise') return `rises ${c.value}%`;
    return `${c.op} ${c.value}`;
}

export default SwapAgent;
