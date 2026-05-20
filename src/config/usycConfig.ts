// USYC (Circle's yield-bearing stablecoin) configuration for Arc Testnet.
//
// USYC is a tokenized US Treasury yield product. Users deposit USDC via the
// Teller contract and receive USYC tokens whose price appreciates over time
// as yield accrues. Redeeming burns USYC and returns USDC + accumulated yield.
//
// Contracts: https://developers.circle.com/tokenized/usyc/smart-contracts

export const USYC_TOKEN_ADDRESS = '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as `0x${string}`;
export const USYC_TELLER_ADDRESS = '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A' as `0x${string}`;
export const USYC_ORACLE_ADDRESS = '0x52b56c7642E71dc54714d879127d97cd0B3D4581' as `0x${string}`;
export const USYC_ENTITLEMENTS_ADDRESS = '0xcc205224862c7641930c87679e98999d23c26113' as `0x${string}`;
export const USYC_DECIMALS = 6;

export const USYC_TELLER_ABI = [
    {
        type: 'function',
        name: 'deposit',
        stateMutability: 'nonpayable',
        inputs: [
            { name: '_assets', type: 'uint256' },
            { name: '_receiver', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'redeem',
        stateMutability: 'nonpayable',
        inputs: [
            { name: '_amount', type: 'uint256' },
            { name: '_receiver', type: 'address' },
            { name: '_account', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
] as const;

export const USYC_ORACLE_ABI = [
    {
        type: 'function',
        name: 'latestRoundData',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: 'roundId', type: 'uint80' },
            { name: 'answer', type: 'int256' },
            { name: 'startedAt', type: 'uint256' },
            { name: 'updatedAt', type: 'uint256' },
            { name: 'answeredInRound', type: 'uint80' },
        ],
    },
] as const;

export const USYC_TOKEN_ABI = [
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
] as const;
