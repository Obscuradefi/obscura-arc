// Pyth Network on-chain interface, used by the frontend to push fresh price
// updates to Arc Testnet when feeds go stale.
//
// Why we need this: ObscuraAMM.getAmountOut and ObscuraRFQ.fairAmountOut
// both call `pyth.getPriceUnsafe()`. If a feed hasn't been updated for a
// long time it can return 0, which makes the AMM revert and the UI show
// "Insufficient liquidity". The "Wake up oracle" button on the swap card
// fixes this from the browser without needing a backend keeper.

export const PYTH_ABI = [
    {
        type: 'function',
        name: 'getUpdateFee',
        stateMutability: 'view',
        inputs: [{ name: 'updateData', type: 'bytes[]' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'updatePriceFeeds',
        stateMutability: 'payable',
        inputs: [{ name: 'updateData', type: 'bytes[]' }],
        outputs: [],
    },
    {
        type: 'function',
        name: 'getPriceUnsafe',
        stateMutability: 'view',
        inputs: [{ name: 'id', type: 'bytes32' }],
        outputs: [
            {
                type: 'tuple',
                components: [
                    { name: 'price', type: 'int64' },
                    { name: 'conf', type: 'uint64' },
                    { name: 'expo', type: 'int32' },
                    { name: 'publishTime', type: 'uint256' },
                ],
            },
        ],
    },
] as const;
