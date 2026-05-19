// Obscura Shield Protocol — programmable privacy on Arc Testnet.
//
// ABI matches `contracts/ObscuraShield.sol`.

import { OBSCURA_SHIELD_ADDRESS } from './arc';

export const SHIELD_CONTRACT_ADDRESS = OBSCURA_SHIELD_ADDRESS;

export enum PrivacyLevel {
    LOW = 0,
    MEDIUM = 1,
    HIGH = 2,
}

export interface PrivacyLevelMeta {
    id: PrivacyLevel;
    label: string;
    description: string;
    /** Approximate lock window in seconds — actual value is read from chain. */
    lockSeconds: number;
    /** Traffic-light color for the UI. */
    color: string;
    /** Background tint for the UI. */
    bg: string;
}

export const PRIVACY_LEVELS: Record<PrivacyLevel, PrivacyLevelMeta> = {
    [PrivacyLevel.LOW]: {
        id: PrivacyLevel.LOW,
        label: 'Low',
        description: 'No lock. Instant withdraw. Minimal privacy.',
        lockSeconds: 0,
        color: '#FF8C42',
        bg: 'rgba(255,140,66,0.08)',
    },
    [PrivacyLevel.MEDIUM]: {
        id: PrivacyLevel.MEDIUM,
        label: 'Medium',
        description: '1-hour mixing window. Balanced privacy.',
        lockSeconds: 60 * 60,
        color: '#22D3EE',
        bg: 'rgba(34,211,238,0.08)',
    },
    [PrivacyLevel.HIGH]: {
        id: PrivacyLevel.HIGH,
        label: 'High',
        description: '24-hour de-correlation. Maximum privacy.',
        lockSeconds: 24 * 60 * 60,
        color: '#4ADE80',
        bg: 'rgba(74,222,128,0.08)',
    },
};

export const SHIELD_ABI = [
    {
        type: 'function',
        name: 'shield',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'asset', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'level', type: 'uint8' },
            { name: 'salt', type: 'bytes32' },
        ],
        outputs: [{ name: 'entryId', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'unshield',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'asset', type: 'address' },
            { name: 'entryId', type: 'uint256' },
            { name: 'salt', type: 'bytes32' },
        ],
        outputs: [{ name: 'amount', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'getEncryptedBalance',
        stateMutability: 'view',
        inputs: [
            { name: 'user', type: 'address' },
            { name: 'asset', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'getEntryCount',
        stateMutability: 'view',
        inputs: [
            { name: 'user', type: 'address' },
            { name: 'asset', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'getEntry',
        stateMutability: 'view',
        inputs: [
            { name: 'user', type: 'address' },
            { name: 'asset', type: 'address' },
            { name: 'entryId', type: 'uint256' },
        ],
        outputs: [
            { name: 'amount', type: 'uint256' },
            { name: 'unlockAt', type: 'uint64' },
            { name: 'level', type: 'uint8' },
            { name: 'active', type: 'bool' },
        ],
    },
    {
        type: 'function',
        name: 'totalShielded',
        stateMutability: 'view',
        inputs: [{ name: 'asset', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'levelLock',
        stateMutability: 'view',
        inputs: [{ name: 'level', type: 'uint8' }],
        outputs: [{ name: '', type: 'uint64' }],
    },
    {
        type: 'event',
        name: 'Shielded',
        inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'asset', type: 'address', indexed: true },
            { name: 'level', type: 'uint8', indexed: true },
            { name: 'entryId', type: 'uint256', indexed: false },
            { name: 'commitment', type: 'bytes32', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'Unshielded',
        inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'asset', type: 'address', indexed: true },
            { name: 'level', type: 'uint8', indexed: true },
            { name: 'entryId', type: 'uint256', indexed: false },
            { name: 'commitment', type: 'bytes32', indexed: false },
        ],
    },
] as const;

// Privacy-asset display map for the UI: "USDC" -> "cUSDC" etc.
export const PRIVACY_TOKENS: Record<string, string> = {
    USDC: 'cUSDC',
    USDT: 'cUSDT',
    USDe: 'cUSDe',
    GOLD: 'cGOLD',
    AAPL: 'cAAPL',
    MSTR: 'cMSTR',
};
