import { useState } from 'react';
import { parseUnits } from 'viem';
import { OBSCURA_AMM_ABI } from '../config/dexConfig';
import { OBSCURA_AMM_ADDRESS } from '../config/arc';
import { PYTH_PRICE_IDS } from '../config/priceFeeds';
import { getPythPriceUpdate, getPythUpdateFee } from '../lib/pythClient';
import { useUnifiedSendTx } from './useUnifiedSendTx';

export interface UsePythSwapResult {
    executePythSwap: (params: {
        fromToken: `0x${string}`;
        toToken: `0x${string}`;
        fromSymbol: string;
        toSymbol: string;
        amountIn: string;
        decimalsIn: number;
        minAmountOut: bigint;
    }) => Promise<void>;
    isPending: boolean;
    isConfirming: boolean;
    isSuccess: boolean;
    error: Error | null;
    hash?: `0x${string}`;
}

/**
 * Pyth-fresh swap path: pulls signed price updates from Hermes, then calls
 * `swapWithPriceUpdate` on ObscuraAMM so the trade settles at the most recent
 * oracle price. The user pays the per-update fee in native USDC (msg.value).
 *
 * Routes through `useUnifiedSendTx` so it works for both:
 *   - EOA wallets (RainbowKit / MetaMask): submitted as a normal payable tx.
 *   - Circle Passkey smart accounts: submitted as a sponsored user
 *     operation. The paymaster covers gas; the Pyth fee comes out of the
 *     smart account's USDC balance.
 *
 * This is the **default** swap path because every trade implicitly keeps
 * Pyth feeds fresh — no separate "wake up oracle" step needed in normal use.
 */
export function usePythSwap(): UsePythSwapResult {
    const [error, setError] = useState<Error | null>(null);
    const [success, setSuccess] = useState(false);
    const { send, isPending, isConfirming, lastHash } = useUnifiedSendTx();

    const executePythSwap = async ({
        fromToken,
        toToken,
        fromSymbol,
        toSymbol,
        amountIn,
        decimalsIn,
        minAmountOut,
    }: Parameters<UsePythSwapResult['executePythSwap']>[0]) => {
        try {
            setError(null);
            setSuccess(false);

            const ids: string[] = [];
            const symA = (PYTH_PRICE_IDS as Record<string, string>)[fromSymbol];
            const symB = (PYTH_PRICE_IDS as Record<string, string>)[toSymbol];
            if (symA) ids.push(symA);
            if (symB) ids.push(symB);

            // If neither leg has a Pyth feed (e.g. USDC↔USDC), fall back to
            // the plain swap() path — `swapWithPriceUpdate` with empty data
            // is rejected by the contract.
            const priceUpdate = ids.length > 0 ? await getPythPriceUpdate(ids) : [];
            const fee = priceUpdate.length > 0 ? getPythUpdateFee(priceUpdate.length) : 0n;

            const amountBN = parseUnits(amountIn, decimalsIn);

            await send({
                to: OBSCURA_AMM_ADDRESS,
                abi: OBSCURA_AMM_ABI,
                functionName: priceUpdate.length > 0 ? 'swapWithPriceUpdate' : 'swap',
                args:
                    priceUpdate.length > 0
                        ? [fromToken, toToken, amountBN, minAmountOut, priceUpdate]
                        : [fromToken, toToken, amountBN, minAmountOut],
                value: fee,
            });
            setSuccess(true);
        } catch (err) {
            const errorMsg = err instanceof Error ? err : new Error('Unknown error');
            setError(errorMsg);
            throw errorMsg;
        }
    };

    return {
        executePythSwap,
        isPending,
        isConfirming,
        isSuccess: success,
        error,
        hash: lastHash,
    };
}
