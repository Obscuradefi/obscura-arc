import { useCallback, useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Abi, type Address, type Hex } from 'viem';
import { useEffectiveAccount } from './useEffectiveAccount';
import { useCircleWallet } from './useCircleWallet';
import { sendGaslessBatch, sendGaslessCall } from '../lib/circleWallet';

export interface TxCall {
    to: Address;
    abi: Abi | readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    value?: bigint;
}

export interface SendTxResult {
    /** Final transaction hash on Arc, viewable on ArcScan. */
    txHash: Hex;
    /** Set when the call was submitted as a Circle user operation. */
    userOpHash?: Hex;
    /** Routing source. */
    source: 'circle' | 'wagmi';
}

export interface UseUnifiedSendTxResult {
    /** Send a single contract call. Picks the right path based on which wallet is active. */
    send: (call: TxCall) => Promise<SendTxResult>;
    /**
     * Send multiple contract calls. With Circle Passkey, all calls are batched
     * into a single user operation (e.g. approve + swap in one click). With
     * RainbowKit, the calls are sent sequentially since EOAs cannot batch.
     */
    sendBatch: (calls: TxCall[]) => Promise<SendTxResult>;
    /** Whether a tx is currently waiting for wallet/passkey confirmation. */
    isPending: boolean;
    /** Whether a wagmi tx is waiting on a block confirmation. */
    isConfirming: boolean;
    /** Last successful tx hash. */
    lastHash: Hex | undefined;
    /** Routing source for the last submission. */
    lastSource: 'circle' | 'wagmi' | null;
    error: string | null;
}

/**
 * Submit transactions through whichever wallet is active.
 *
 *   - Circle Passkey active -> bundlerClient.sendUserOperation with
 *     paymaster: true (gasless, sponsored by Circle Gas Station). Batching
 *     supported natively.
 *   - RainbowKit / EOA active -> wagmi writeContract. No batching; multi-call
 *     flows submit sequentially with one wallet popup per tx.
 *
 * The returned `txHash` is always a real Arc transaction hash that can be
 * pasted into ArcScan, regardless of routing path.
 */
export function useUnifiedSendTx(): UseUnifiedSendTxResult {
    const { source } = useEffectiveAccount();
    const { session } = useCircleWallet();
    const { writeContractAsync } = useWriteContract();

    const [pending, setPending] = useState(false);
    const [lastHash, setLastHash] = useState<Hex | undefined>();
    const [lastSource, setLastSource] = useState<'circle' | 'wagmi' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { isLoading: isConfirming } = useWaitForTransactionReceipt({
        hash: source === 'wagmi' ? lastHash : undefined,
    });

    const send = useCallback(
        async (call: TxCall): Promise<SendTxResult> => {
            setError(null);
            setPending(true);
            try {
                if (source === 'circle' && session) {
                    const { userOpHash, txHash } = await sendGaslessCall(session, {
                        to: call.to,
                        abi: call.abi as readonly unknown[],
                        functionName: call.functionName,
                        args: call.args,
                        value: call.value,
                    });
                    setLastHash(txHash);
                    setLastSource('circle');
                    return { txHash, userOpHash, source: 'circle' };
                }

                // Default: wagmi. Throws if no wallet is connected.
                const txHash = await writeContractAsync({
                    address: call.to,
                    abi: call.abi as Abi,
                    functionName: call.functionName,
                    args: call.args as readonly unknown[],
                    value: call.value,
                });
                setLastHash(txHash);
                setLastSource('wagmi');
                return { txHash, source: 'wagmi' };
            } catch (e: any) {
                setError(e?.shortMessage ?? e?.message ?? 'Transaction failed');
                throw e;
            } finally {
                setPending(false);
            }
        },
        [source, session, writeContractAsync]
    );

    const sendBatch = useCallback(
        async (calls: TxCall[]): Promise<SendTxResult> => {
            if (calls.length === 0) throw new Error('No calls to send');
            setError(null);
            setPending(true);
            try {
                if (source === 'circle' && session) {
                    const { userOpHash, txHash } = await sendGaslessBatch(
                        session,
                        calls.map((c) => ({
                            to: c.to,
                            abi: c.abi as readonly unknown[],
                            functionName: c.functionName,
                            args: c.args,
                            value: c.value,
                        }))
                    );
                    setLastHash(txHash);
                    setLastSource('circle');
                    return { txHash, userOpHash, source: 'circle' };
                }

                // Wagmi: send sequentially. The last hash is what we return.
                let lastTx: Hex | undefined;
                for (const c of calls) {
                    lastTx = await writeContractAsync({
                        address: c.to,
                        abi: c.abi as Abi,
                        functionName: c.functionName,
                        args: c.args as readonly unknown[],
                        value: c.value,
                    });
                }
                setLastHash(lastTx);
                setLastSource('wagmi');
                return { txHash: lastTx!, source: 'wagmi' };
            } catch (e: any) {
                setError(e?.shortMessage ?? e?.message ?? 'Batch failed');
                throw e;
            } finally {
                setPending(false);
            }
        },
        [source, session, writeContractAsync]
    );

    return {
        send,
        sendBatch,
        isPending: pending,
        isConfirming,
        lastHash,
        lastSource,
        error,
    };
}
