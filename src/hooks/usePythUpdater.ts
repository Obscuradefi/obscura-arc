import { useCallback, useState } from 'react';
import {
    useAccount,
    usePublicClient,
    useWriteContract,
    useWaitForTransactionReceipt,
} from 'wagmi';
import { PYTH_ABI } from '../config/pythAbi';
import { PYTH_CONTRACT_ADDRESS } from '../config/arc';
import { PYTH_PRICE_IDS } from '../config/priceFeeds';
import { getPythPriceUpdate } from '../lib/pythClient';

/// Symbols whose Pyth feeds we routinely refresh so the AMM + RFQ contracts
/// can quote them. Must include every asset listed in MOCK_TOKENS plus EURC.
const ROUTINE_SYMBOLS = ['EURC', 'JPYC', 'GOLD', 'AAPL', 'MSTR'] as const;

export interface UsePythUpdaterResult {
    /** Push the latest Hermes prices for `symbols` (defaults to all listed assets). */
    push: (symbols?: readonly string[]) => Promise<`0x${string}` | null>;
    /** Tx state. */
    isPending: boolean;
    isConfirming: boolean;
    isSuccess: boolean;
    error: string | null;
    hash: `0x${string}` | undefined;
}

/**
 * Push fresh Pyth price updates from Hermes to the Pyth contract on Arc.
 *
 * The user pays the per-update fee in native USDC (Arc's native gas asset).
 * Fee is read on-chain via `getUpdateFee` so we send the exact amount and
 * never overpay.
 */
export function usePythUpdater(): UsePythUpdaterResult {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [error, setError] = useState<string | null>(null);

    const {
        writeContractAsync,
        data: hash,
        isPending,
        error: writeError,
    } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const push = useCallback(
        async (symbols: readonly string[] = ROUTINE_SYMBOLS): Promise<`0x${string}` | null> => {
            setError(null);

            if (!address) {
                setError('Connect a wallet first.');
                return null;
            }
            if (!publicClient) {
                setError('No RPC client available.');
                return null;
            }

            const ids = symbols
                .map((s) => (PYTH_PRICE_IDS as Record<string, string>)[s])
                .filter(Boolean);
            if (ids.length === 0) {
                setError('No Pyth feed IDs found for given symbols.');
                return null;
            }

            try {
                const updates = (await getPythPriceUpdate(ids)) as `0x${string}`[];
                if (updates.length === 0) {
                    setError('Hermes returned no updates.');
                    return null;
                }

                // Read the exact on-chain fee so we send the right msg.value.
                const fee = (await publicClient.readContract({
                    address: PYTH_CONTRACT_ADDRESS,
                    abi: PYTH_ABI,
                    functionName: 'getUpdateFee',
                    args: [updates],
                })) as bigint;

                const tx = await writeContractAsync({
                    address: PYTH_CONTRACT_ADDRESS,
                    abi: PYTH_ABI,
                    functionName: 'updatePriceFeeds',
                    args: [updates],
                    value: fee,
                });

                return tx;
            } catch (e: any) {
                console.error('[pyth-updater]', e);
                setError(e?.shortMessage ?? e?.message ?? 'Push failed');
                return null;
            }
        },
        [address, publicClient, writeContractAsync]
    );

    return {
        push,
        isPending,
        isConfirming,
        isSuccess,
        error: error || writeError?.message || null,
        hash,
    };
}
