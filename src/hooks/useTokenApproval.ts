import { useState, useEffect, useCallback } from 'react';
import { useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { ERC20_ABI } from '../config/dexConfig';
import { OBSCURA_AMM_ADDRESS } from '../config/arc';
import { useEffectiveAccount } from './useEffectiveAccount';
import { useUnifiedSendTx } from './useUnifiedSendTx';

/**
 * Track ERC-20 allowance vs a given spender (default: ObscuraAMM) and expose
 * an `approve` button. Routes through whichever wallet is active (Circle
 * Passkey smart account or RainbowKit EOA). Decimals must be passed because
 * USDC on Arc is 6 dec.
 */
export function useTokenApproval(
    tokenAddress: string | undefined,
    amount: string,
    decimals: number = 18,
    spenderAddress?: `0x${string}`
) {
    const { address } = useEffectiveAccount();
    const [needsApproval, setNeedsApproval] = useState(false);
    const [approvalHash, setApprovalHash] = useState<`0x${string}` | undefined>();
    const [isApprovePending, setApprovePending] = useState(false);
    const [approveError, setApproveError] = useState<unknown>(null);
    const spender = spenderAddress || OBSCURA_AMM_ADDRESS;

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && tokenAddress ? [address, spender] : undefined,
        query: {
            enabled: !!address && !!tokenAddress,
        },
    });

    const {
        isLoading: isApprovalConfirming,
        isSuccess: isApprovalConfirmed,
    } = useWaitForTransactionReceipt({
        hash: approvalHash,
    });

    const { send } = useUnifiedSendTx();

    useEffect(() => {
        if (!amount || !tokenAddress) {
            setNeedsApproval(false);
            return;
        }
        if (allowance === undefined) {
            setNeedsApproval(true);
            return;
        }
        try {
            const amountBN = parseUnits(amount, decimals);
            setNeedsApproval((allowance as bigint) < amountBN);
        } catch {
            setNeedsApproval(false);
        }
    }, [allowance, amount, tokenAddress, decimals]);

    useEffect(() => {
        if (isApprovalConfirmed) {
            refetchAllowance();
        }
    }, [isApprovalConfirmed, refetchAllowance]);

    const handleApprove = useCallback(async () => {
        if (!tokenAddress || !amount) return;
        setApproveError(null);
        setApprovePending(true);
        try {
            const amountBN = parseUnits(amount, decimals);
            const { txHash } = await send({
                to: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [spender, amountBN],
            });
            setApprovalHash(txHash);
        } catch (error) {
            console.error('Approval error:', error);
            setApproveError(error);
        } finally {
            setApprovePending(false);
        }
    }, [send, tokenAddress, amount, decimals, spender]);

    return {
        needsApproval,
        allowance,
        handleApprove,
        isApprovePending,
        isApprovalConfirming,
        isApprovalConfirmed,
        approvalHash,
        approveError,
    };
}
