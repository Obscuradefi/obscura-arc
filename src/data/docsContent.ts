// Documentation content rendered by `src/pages/DocsPage.tsx`.
//
// All contract addresses below should match `src/config/contracts.generated.ts`.
// Prefer prose that references USDC (the Arc native gas token) over USDO.

export interface DocSection {
    id: string;
    title: string;
    icon: string;
    pages: DocPage[];
}

export interface DocPage {
    id: string;
    title: string;
    content: DocBlock[];
}

export interface DocBlock {
    type: 'heading' | 'paragraph' | 'code' | 'list' | 'callout' | 'table' | 'divider' | 'steps';
    content?: string;
    language?: string;
    items?: string[];
    variant?: 'info' | 'warning' | 'tip' | 'danger';
    title?: string;
    headers?: string[];
    rows?: string[][];
    steps?: { title: string; description: string }[];
    level?: number;
}

const ARC_USDC = '0x3600000000000000000000000000000000000000';

export const docsContent: DocSection[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        icon: '>',
        pages: [
            {
                id: 'introduction',
                title: 'Introduction',
                content: [
                    { type: 'heading', content: 'What is Obscura?', level: 1 },
                    {
                        type: 'paragraph',
                        content:
                            'Obscura is a privacy-first DeFi protocol on Arc Testnet by Circle. It combines an intent-based AI agent, hybrid AMM + RFQ routing, programmable privacy levels, and USDC-quoted markets. USDC is the native gas token on Arc, so every swap, deposit, and shielded entry settles in USDC without bridging.',
                    },
                    {
                        type: 'callout',
                        variant: 'info',
                        title: 'Current Status',
                        content:
                            'Obscura is live on Arc Testnet (Chain ID 5042002). Mock-asset tokens (GOLD, AAPL, MSTR, USDe, USDT) are synthetic and have no monetary value. USDC is real testnet USDC from the Circle Faucet.',
                    },
                    { type: 'heading', content: 'Key Features', level: 2 },
                    {
                        type: 'list',
                        items: [
                            '**Programmable Privacy**: Choose Low/Medium/High privacy levels per shielded deposit. Higher levels apply longer mixing windows for stronger temporal de-correlation.',
                            '**Hybrid Routing**: Smart AMM + simulated RFQ routing exposes best-execution behaviour familiar from production DEXs.',
                            '**Intent-Based AI Agent**: Type natural-language commands ("buy GOLD with 50 USDC if GOLD drops 5%") and the agent parses, previews, and executes the trade.',
                            '**USDC-Native Markets**: Every pool is paired with USDC. No bridging, no wrapped gas tokens, predictable sub-cent fees.',
                            '**Encrypted Vault Entries**: Each shield deposit emits an opaque commitment so external indexers cannot trivially link your deposits to withdrawals.',
                            '**Sub-Second Finality**: Built on Arc, transactions confirm in under one second.',
                        ],
                    },
                    { type: 'heading', content: 'Architecture Overview', level: 2 },
                    {
                        type: 'table',
                        headers: ['Layer', 'Component', 'Description'],
                        rows: [
                            ['Privacy', 'ObscuraShield', 'Programmable privacy pool with Low/Medium/High lock windows.'],
                            ['Trading', 'ObscuraAMM', 'USDC-quoted constant-product AMM with 0.30% pool fee.'],
                            ['Routing', 'Hybrid Router', 'Compares the on-chain AMM quote with simulated RFQ liquidity.'],
                            ['Intent', 'Obscura Agent', 'Parses natural language into swap/shield/conditional intents.'],
                            ['Settlement', 'USDC (native gas)', 'All gas + pool legs denominated in USDC on Arc.'],
                        ],
                    },
                ],
            },
            {
                id: 'quick-start',
                title: 'Quick Start',
                content: [
                    { type: 'heading', content: 'Quick Start Guide', level: 1 },
                    {
                        type: 'paragraph',
                        content:
                            'Get started with Obscura on Arc Testnet in five steps.',
                    },
                    {
                        type: 'steps',
                        steps: [
                            {
                                title: 'Add Arc Testnet to your wallet',
                                description:
                                    'Open https://docs.arc.io/arc/references/connect-to-arc and click the one-click Connect Wallet widget, or add it manually with RPC https://rpc.testnet.arc.network and Chain ID 5042002.',
                            },
                            {
                                title: 'Get testnet USDC',
                                description:
                                    'Visit https://faucet.circle.com, select Arc Testnet, paste your wallet address, and request testnet USDC. USDC is the native gas token, so a small balance covers gas + initial trades.',
                            },
                            {
                                title: 'Connect to Obscura',
                                description:
                                    'Click "Connect Wallet" in the Obscura header. Confirm the Arc Testnet network in your wallet.',
                            },
                            {
                                title: 'Faucet mock assets',
                                description:
                                    'Use the in-app "Faucet" button to mint synthetic GOLD, AAPL, MSTR, USDT, or USDe. Each click cycles to the next asset and mints a small batch.',
                            },
                            {
                                title: 'Trade or shield',
                                description:
                                    'Open Swap to trade against ObscuraAMM, or Shield to deposit at a chosen privacy level. Try the AI agent for natural language: "swap 5 USDC to GOLD" or "shield 10 USDC at high privacy".',
                            },
                        ],
                    },
                    {
                        type: 'callout',
                        variant: 'tip',
                        title: 'Pro Tip',
                        content:
                            'Try a conditional intent: "buy GOLD with 50 USDC if GOLD drops 5%". The agent will watch the price and execute when triggered.',
                    },
                ],
            },
            {
                id: 'glossary',
                title: 'Glossary',
                content: [
                    { type: 'heading', content: 'Glossary', level: 1 },
                    {
                        type: 'table',
                        headers: ['Term', 'Definition'],
                        rows: [
                            ['Arc', 'Layer-1 by Circle where USDC is the native gas token. Sub-second finality.'],
                            ['AMM', 'Automated Market Maker. Obscura\'s pools use the constant-product formula x · y = k.'],
                            ['RFQ', 'Request-for-Quote. Off-chain quote stream simulated client-side in this build.'],
                            ['Privacy Level', 'Per-deposit setting (Low/Medium/High) controlling the mixing-window lock.'],
                            ['cTOKEN', 'Confidential token: the shielded representation of an asset (e.g. cUSDC for shielded USDC).'],
                            ['Slippage', 'Difference between expected and executed price.'],
                            ['Price Impact', 'Effect of a trade on pool price, function of trade size vs reserves.'],
                            ['Conditional Intent', 'Natural-language instruction with a price condition that the agent watches and triggers.'],
                            ['Commitment', 'keccak256 hash of (user, asset, amount, level, salt, entryId) emitted in shield/unshield events.'],
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'core-concepts',
        title: 'Core Concepts',
        icon: '*',
        pages: [
            {
                id: 'privacy-layer',
                title: 'Privacy Layer',
                content: [
                    { type: 'heading', content: 'Privacy Layer', level: 1 },
                    {
                        type: 'paragraph',
                        content:
                            'ObscuraShield introduces *programmable privacy levels*. When you shield an asset you choose Low, Medium, or High; each level applies a different mixing-window lock before unshield is allowed. This breaks the naive timing correlation between deposit and withdrawal that public chains otherwise leak.',
                    },
                    {
                        type: 'table',
                        headers: ['Level', 'Lock window', 'Use case'],
                        rows: [
                            ['Low', '0 seconds', 'Fast settlement; small amounts.'],
                            ['Medium', '1 hour', 'Balanced privacy and UX.'],
                            ['High', '24 hours', 'Stronger temporal de-correlation; larger transfers.'],
                        ],
                    },
                    {
                        type: 'callout',
                        variant: 'warning',
                        title: 'Honest limitation',
                        content:
                            'This testnet build stores raw amounts on-chain because Arc\'s opt-in confidential transfer primitives are still rolling out. Each shield/unshield emits an opaque commitment hash so external indexers see only a blinded reference. The next upgrade swaps the storage layer for a Pedersen / zk-SNARK commitment without changing the public ABI.',
                    },
                    {
                        type: 'heading',
                        content: 'Shield + Unshield Flow',
                        level: 2,
                    },
                    {
                        type: 'code',
                        language: 'text',
                        content:
                            'Shield (Medium privacy):\n  1. approve(ObscuraShield, amount)\n  2. shield(asset, amount, MEDIUM, salt)\n  3. ObscuraShield stores entry; encryptedBalance[user][asset] += amount\n  4. emit Shielded(user, asset, MEDIUM, entryId, commitment)\n\nUnshield:\n  1. unshield(asset, entryId, salt)\n  2. require block.timestamp >= entry.unlockAt\n  3. encryptedBalance[user][asset] -= amount\n  4. ERC-20 transferred back to user\n  5. emit Unshielded(user, asset, entry.level, entryId, commitment)',
                    },
                ],
            },
            {
                id: 'smart-routing',
                title: 'Smart Routing',
                content: [
                    { type: 'heading', content: 'Hybrid AMM + RFQ Routing', level: 1 },
                    {
                        type: 'paragraph',
                        content:
                            'Obscura combines two execution mechanisms — the on-chain ObscuraAMM and a client-side RFQ simulator — to model best-execution UX. The RFQ leg is intentionally off-chain in this build; on-chain RFQ settlement is on the roadmap.',
                    },
                    {
                        type: 'code',
                        language: 'typescript',
                        content:
                            "function determineRoute(usdValue: number): 'AMM' | 'RFQ' | 'HYBRID' {\n  if (usdValue < 100_000) return 'AMM';\n  if (usdValue < 500_000) return 'HYBRID';\n  return 'RFQ';\n}",
                    },
                    {
                        type: 'heading',
                        content: 'AMM mechanics',
                        level: 2,
                    },
                    {
                        type: 'paragraph',
                        content:
                            'Every non-USDC asset has its own (asset, USDC) pool. Pricing follows the standard constant-product formula with a 0.30% fee. Cross-asset swaps (e.g. GOLD → AAPL) route automatically through the shared USDC reserve in a single transaction.',
                    },
                    {
                        type: 'code',
                        language: 'text',
                        content:
                            'amountInWithFee = amountIn * (10000 - 30)\nnumerator       = amountInWithFee * reserveOut\ndenominator     = reserveIn * 10000 + amountInWithFee\namountOut       = numerator / denominator',
                    },
                ],
            },
            {
                id: 'ai-agent',
                title: 'Intent Agent',
                content: [
                    { type: 'heading', content: 'Intent-Based AI Agent', level: 1 },
                    {
                        type: 'paragraph',
                        content:
                            'Obscura\'s agent parses natural language into structured intents. It supports immediate intents (swap, shield, unshield, portfolio) and *conditional* intents that watch a price feed and execute only when a condition triggers.',
                    },
                    {
                        type: 'table',
                        headers: ['Intent', 'Example', 'Behaviour'],
                        rows: [
                            ['Swap', '"swap 5 USDC to GOLD"', 'Approves + executes via ObscuraAMM.'],
                            ['Shield', '"shield 10 USDC at high privacy"', 'Approves + shields with the chosen level.'],
                            ['Unshield', '"unshield USDC entry 0"', 'Calls unshield once the lock has elapsed.'],
                            ['Portfolio', '"cek portfolio"', 'Summarises balances and tracked tokens.'],
                            ['Conditional', '"buy GOLD with 50 USDC if GOLD drops 5%"', 'Captures the entry price, polls every 30s, executes on trigger.'],
                        ],
                    },
                    {
                        type: 'callout',
                        variant: 'tip',
                        title: 'Bilingual',
                        content:
                            'Indonesian commands are accepted: "tukar 10 USDC ke GOLD", "lindungi 50 USDC tingkat tinggi", "kalau GOLD turun 5%".',
                    },
                    {
                        type: 'paragraph',
                        content:
                            'Parsing is regex-first (deterministic, free) with an optional Jatevo LLM fallback (server-side via /api/ai-parse). All trades require explicit wallet confirmation.',
                    },
                ],
            },
            {
                id: 'tokenized-assets',
                title: 'Tokenized Assets',
                content: [
                    { type: 'heading', content: 'Supported Assets', level: 1 },
                    {
                        type: 'paragraph',
                        content:
                            'USDC is the quote token for every market and the native gas token on Arc. The remaining symbols are mock ERC-20 contracts deployed by the project for demo purposes.',
                    },
                    {
                        type: 'table',
                        headers: ['Symbol', 'Category', 'Decimals', 'Notes'],
                        rows: [
                            ['USDC', 'Stablecoin', '6 (ERC-20) / 18 (gas)', 'Native to Arc; faucet at faucet.circle.com.'],
                            ['USDT', 'Stablecoin', '6', 'Mock token. In-app faucet.'],
                            ['USDe', 'Stablecoin', '18', 'Mock token. In-app faucet.'],
                            ['GOLD', 'Commodity', '18', 'Mock tokenized gold. In-app faucet.'],
                            ['AAPL', 'Equity', '18', 'Mock equity token. In-app faucet.'],
                            ['MSTR', 'Equity', '18', 'Mock equity token. In-app faucet.'],
                        ],
                    },
                    {
                        type: 'callout',
                        variant: 'info',
                        title: 'Decimals matter',
                        content:
                            'USDC on Arc uses 6 decimals at the ERC-20 interface and 18 decimals at the protocol gas layer (the same balance, two views). Always call decimals() rather than hard-coding 18.',
                    },
                ],
            },
        ],
    },
    {
        id: 'developers',
        title: 'Developers',
        icon: '<>',
        pages: [
            {
                id: 'contract-addresses',
                title: 'Contract Addresses',
                content: [
                    { type: 'heading', content: 'Contract Addresses (Arc Testnet)', level: 1 },
                    {
                        type: 'paragraph',
                        content:
                            'Run `npm run deploy:arc` to deploy and refresh `src/config/contracts.generated.ts`. The values below are placeholders until that script runs.',
                    },
                    {
                        type: 'code',
                        language: 'text',
                        content:
                            `Arc Testnet — Chain ID 5042002\n\nUSDC (native, ERC-20 interface): ${ARC_USDC}\nObscuraAMM:                      <set after deploy:arc>\nObscuraShield:                   <set after deploy:arc>\n\nMock tokens (filled in by deploy script):\n  USDT, USDe, GOLD, AAPL, MSTR`,
                    },
                    { type: 'heading', content: 'Network Configuration', level: 2 },
                    {
                        type: 'code',
                        language: 'typescript',
                        content:
                            `import { defineChain } from 'viem';\n\nexport const arcTestnet = defineChain({\n  id: 5042002,\n  name: 'Arc Testnet',\n  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },\n  rpcUrls: {\n    default: { http: ['https://rpc.testnet.arc.network'] },\n  },\n  blockExplorers: {\n    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },\n  },\n  testnet: true,\n});`,
                    },
                ],
            },
            {
                id: 'integration-guide',
                title: 'Integration Guide',
                content: [
                    { type: 'heading', content: 'Integration Guide', level: 1 },
                    {
                        type: 'paragraph',
                        content:
                            'Obscura is fully EVM-compatible. The same wagmi/viem patterns you use on any L2 work on Arc — just point at the Arc Testnet RPC.',
                    },
                    { type: 'heading', content: 'Setup', level: 2 },
                    {
                        type: 'code',
                        language: 'bash',
                        content: 'npm install viem wagmi @tanstack/react-query @rainbow-me/rainbowkit',
                    },
                    { type: 'heading', content: 'Reading USDC Balance', level: 2 },
                    {
                        type: 'code',
                        language: 'typescript',
                        content:
                            `import { createPublicClient, http, formatUnits } from 'viem';\nimport { arcTestnet } from './chains';\n\nconst client = createPublicClient({ chain: arcTestnet, transport: http() });\n\nconst raw = await client.readContract({\n  address: '${ARC_USDC}',\n  abi: [{ name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],\n  functionName: 'balanceOf',\n  args: [userAddress],\n});\nconst usdcBalance = formatUnits(raw, 6);`,
                    },
                    { type: 'heading', content: 'Executing a Swap', level: 2 },
                    {
                        type: 'code',
                        language: 'typescript',
                        content:
                            `// 1. Approve USDC -> ObscuraAMM\nawait writeContract({\n  address: USDC_ADDRESS,\n  abi: ERC20_ABI,\n  functionName: 'approve',\n  args: [OBSCURA_AMM_ADDRESS, parseUnits('100', 6)],\n});\n\n// 2. Swap USDC -> GOLD\nawait writeContract({\n  address: OBSCURA_AMM_ADDRESS,\n  abi: OBSCURA_AMM_ABI,\n  functionName: 'swap',\n  args: [USDC_ADDRESS, GOLD_ADDRESS, parseUnits('100', 6), 0n],\n});`,
                    },
                ],
            },
        ],
    },
    {
        id: 'resources',
        title: 'Resources',
        icon: '?',
        pages: [
            {
                id: 'faq',
                title: 'FAQ',
                content: [
                    { type: 'heading', content: 'Frequently Asked Questions', level: 1 },
                    { type: 'heading', content: 'Why USDC as gas?', level: 3 },
                    {
                        type: 'paragraph',
                        content:
                            'Arc denominates gas in USDC at 18-decimal precision. Application-level USDC transfers use the standard 6-decimal ERC-20 interface. Because gas, settlement, and quote token are the same asset, fees are predictable and there is no native-currency volatility risk.',
                    },
                    { type: 'heading', content: 'Are tokens real?', level: 3 },
                    {
                        type: 'paragraph',
                        content:
                            'USDC on Arc Testnet is a real Circle-issued testnet asset. Mock GOLD/AAPL/MSTR/USDT/USDe are synthetic tokens deployed by the project so demos can interact without real-world exposure.',
                    },
                    { type: 'heading', content: 'How is privacy enforced?', level: 3 },
                    {
                        type: 'paragraph',
                        content:
                            'The current build stores plain-text amounts on-chain but emits opaque commitments and applies per-level lock windows. The roadmap upgrades to Pedersen / zk-SNARK commitments once Arc\'s opt-in confidential transfer primitives stabilise.',
                    },
                ],
            },
            {
                id: 'security',
                title: 'Security & Audits',
                content: [
                    { type: 'heading', content: 'Security & Audits', level: 1 },
                    {
                        type: 'callout',
                        variant: 'warning',
                        title: 'Testnet Phase',
                        content:
                            'Smart contracts have not been formally audited. Do NOT use with mainnet funds. Mainnet deployment will include audits.',
                    },
                    {
                        type: 'list',
                        items: [
                            '**Non-custodial**: every transaction is signed by the user wallet.',
                            '**Open Source**: contracts and frontend live in the same repo.',
                            '**Reentrancy-aware**: shield/unshield use checks-effects-interactions.',
                            '**Replayable salts**: shield commitments include caller-supplied salt to prevent enumeration.',
                        ],
                    },
                ],
            },
        ],
    },
];
