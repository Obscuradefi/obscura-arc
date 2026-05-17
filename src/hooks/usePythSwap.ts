import { useState } from 'react';
import { parseUnits } from 'viem';
import { usePublicClient } from 'wagmi';
import { OBSCURA_AMM_ABI } from '../config/dexConfig';
import { OBSCURA_AMM_ADDRESS, PYTH_CONTRACT_ADDRESS } from '../config/arc';
import { PYTH_ABI } from '../config/pythAbi';
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
    const publicClient = usePublicClient();

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

            // Fetch the **on-chain** Pyth update fee instead of hardcoding it.
            // Pyth charges per-update bytes which varies; sending too little
            // makes the AMM revert with `AMM: pyth fee`.
            let fee = 0n;
            if (priceUpdate.length > 0) {
                if (publicClient) {
                    try {
                        fee = (await publicClient.readContract({
                            address: PYTH_CONTRACT_ADDRESS,
                            abi: PYTH_ABI,
                            functionName: 'getUpdateFee',
                            args: [priceUpdate as readonly `0x${string}`[]],
                        })) as bigint;
                        // 20% safety buffer in case of rounding / mempool drift.
                        fee = (fee * 120n) / 100n;
                    } catch {
                        fee = getPythUpdateFee(priceUpdate.length);
                    }
                } else {
                    fee = getPythUpdateFee(priceUpdate.length);
                }
            }

            const amountBN = parseUnits(amountIn, decimalsIn);

            console.log('[pythSwap] sending', {
                fromToken,
                toToken,
                amountIn,
                fee: fee.toString(),
                priceUpdates: priceUpdate.length,
            });

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
            console.error('[pythSwap] execute failed', err);
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
