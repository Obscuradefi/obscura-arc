import React, { useState } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';
import { PYTH_CONTRACT_ADDRESS } from '../config/arc';
import { PYTH_PRICE_IDS } from '../config/priceFeeds';
import { useEffectiveAccount } from '../hooks/useEffectiveAccount';
import { useUnifiedSendTx } from '../hooks/useUnifiedSendTx';

const pythAbi = parseAbi([
    'function updatePriceFeeds(bytes[] calldata updateData) external payable',
    'function getUpdateFee(bytes[] calldata updateData) external view returns (uint)'
]);

/**
 * Push fresh Pyth prices from Hermes to Arc Testnet.
 *
 * Works with either wallet path:
 *   - EOA (RainbowKit): submits a normal payable tx via wagmi.
 *   - Circle Passkey: submits a user operation via the Modular Wallets
 *     bundler. The Pyth update fee comes out of the smart account's USDC
 *     balance. Note: gasless via Gas Station only covers gas, not msg.value
 *     to external contracts, so the smart account must hold enough USDC
 *     to cover the (very small) Pyth fee.
 */
export default function WakeUpOracle() {
    const { address, source } = useEffectiveAccount();
    const publicClient = usePublicClient();
    const { send } = useUnifiedSendTx();
    const [loading, setLoading] = useState(false);

    const handleWakeUp = async () => {
        if (!address) return alert("Please connect a wallet (or sign in with Circle Passkey) first");
        if (!publicClient) return alert("Public client not ready");
        setLoading(true);
        try {
            const feedIds = Object.values(PYTH_PRICE_IDS);
            const res = await fetch(
                `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedIds.join('&ids[]=')}`
            );
            if (!res.ok) throw new Error("Hermes fetch failed");
            const data = await res.json();
            const updateData = data.binary.data.map((hex: string) => `0x${hex}`);

            const fee = (await publicClient.readContract({
                address: PYTH_CONTRACT_ADDRESS as `0x${string}`,
                abi: pythAbi,
                functionName: 'getUpdateFee',
                args: [updateData],
            })) as bigint;

            const { txHash } = await send({
                to: PYTH_CONTRACT_ADDRESS as `0x${string}`,
                abi: pythAbi,
                functionName: 'updatePriceFeeds',
                args: [updateData],
                value: fee,
            });

            console.log("Wake up tx:", txHash, "via", source);
            alert(`Oracle woke up via ${source === 'circle' ? 'Circle Passkey' : 'wallet'}. Fresh prices pushed to Arc.`);
        } catch (e: any) {
            console.error(e);
            alert("Failed to wake up Oracle: " + (e?.shortMessage ?? e?.message ?? String(e)));
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleWakeUp}
            disabled={loading}
            style={{
                background: 'rgba(255, 153, 0, 0.1)',
                border: '1px solid rgba(255, 153, 0, 0.3)',
                color: '#ff9900',
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '0.02em',
                opacity: loading ? 0.6 : 1,
            }}
            title="Push fresh prices from Hermes to Arc Testnet"
        >
            {loading ? 'Waking...' : 'Wake Oracle'}
        </button>
    );
}
