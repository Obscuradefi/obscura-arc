import React, { useState } from 'react';
import { useWriteContract, useAccount, usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';
import { PYTH_CONTRACT_ADDRESS } from '../config/arc';
import { PYTH_PRICE_IDS } from '../config/priceFeeds';

const pythAbi = parseAbi([
    'function updatePriceFeeds(bytes[] calldata updateData) external payable',
    'function getUpdateFee(bytes[] calldata updateData) external view returns (uint)'
]);

export default function WakeUpOracle() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const [loading, setLoading] = useState(false);
    
    const handleWakeUp = async () => {
        if (!address) return alert("Please connect wallet first");
        if (!publicClient) return alert("Public client not ready");
        setLoading(true);
        try {
            const feedIds = Object.values(PYTH_PRICE_IDS);
            const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedIds.join('&ids[]=')}`);
            if (!res.ok) throw new Error("Hermes fetch failed");
            const data = await res.json();
            const updateData = data.binary.data.map((hex: string) => `0x${hex}`);
            
            const fee = await publicClient.readContract({
                address: PYTH_CONTRACT_ADDRESS as `0x${string}`,
                abi: pythAbi,
                functionName: 'getUpdateFee',
                args: [updateData]
            });
            
            const tx = await writeContractAsync({
                address: PYTH_CONTRACT_ADDRESS as `0x${string}`,
                abi: pythAbi,
                functionName: 'updatePriceFeeds',
                args: [updateData],
                value: fee as bigint
            });
            
            console.log("Wake up tx:", tx);
            alert("Oracle woke up! Fresh prices pushed to Arc Testnet.");
        } catch (e: any) {
            console.error(e);
            alert("Failed to wake up Oracle: " + e.message);
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
