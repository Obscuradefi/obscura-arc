import { useAccount, useWatchContractEvent } from 'wagmi';
import { formatUnits } from 'viem';
import { addActivity } from '../lib/fluxMock';
import { OBSCURA_AMM_ABI } from '../config/dexConfig';
import { SHIELD_ABI } from '../config/shieldConfig';
import { OBSCURA_AMM_ADDRESS, OBSCURA_SHIELD_ADDRESS } from '../config/arc';
import { FLUX_ASSETS } from '../data/fluxAssets';

const processedTxs = new Set<string>();

function lookupAsset(addr: string | undefined) {
    if (!addr) return undefined;
    return FLUX_ASSETS.find(
        (a) => a.contractAddress && a.contractAddress.toLowerCase() === addr.toLowerCase()
    );
}

function symbolFor(addr: string | undefined): string {
    return lookupAsset(addr)?.symbol ?? 'Token';
}

function decimalsFor(addr: string | undefined): number {
    return lookupAsset(addr)?.decimals ?? 18;
}

/**
 * Mirror on-chain swap/shield/unshield events into the local activity log so
 * the portfolio tab feels live. Only events for the connected user are
 * surfaced; we de-dupe by tx hash. Each watcher is gated on the contract
 * being deployed (non-zero address) so the hook is safe to mount before
 * `npm run deploy:arc` has been run.
 */
export function useLiveActivitySync() {
    const { address } = useAccount();

    const ammDeployed =
        OBSCURA_AMM_ADDRESS &&
        OBSCURA_AMM_ADDRESS !== '0x0000000000000000000000000000000000000000';
    const shieldDeployed =
        OBSCURA_SHIELD_ADDRESS &&
        OBSCURA_SHIELD_ADDRESS !== '0x0000000000000000000000000000000000000000';

    useWatchContractEvent({
        address: OBSCURA_AMM_ADDRESS,
        abi: OBSCURA_AMM_ABI,
        eventName: 'Swap',
        args: { user: address },
        enabled: !!ammDeployed && !!address,
        onLogs(logs) {
            logs.forEach((log) => {
                if (!log.transactionHash || processedTxs.has(log.transactionHash)) return;
                if ((log.args as any).user?.toLowerCase() !== address?.toLowerCase()) return;
                processedTxs.add(log.transactionHash);

                const inAddr = (log.args as any).tokenIn as string;
                const outAddr = (log.args as any).tokenOut as string;
                const amountIn = formatUnits((log.args as any).amountIn as bigint, decimalsFor(inAddr));
                const amountOut = formatUnits((log.args as any).amountOut as bigint, decimalsFor(outAddr));

                addActivity({
                    type: 'swap',
                    description: `Swapped ${parseFloat(amountIn).toFixed(4)} ${symbolFor(inAddr)} for ${parseFloat(amountOut).toFixed(4)} ${symbolFor(outAddr)}`,
                });
            });
        },
    } as any);

    useWatchContractEvent({
        address: OBSCURA_SHIELD_ADDRESS,
        abi: SHIELD_ABI,
        eventName: 'Shielded',
        args: { user: address },
        enabled: !!shieldDeployed && !!address,
        onLogs(logs) {
            logs.forEach((log) => {
                if (!log.transactionHash || processedTxs.has(log.transactionHash)) return;
                if ((log.args as any).user?.toLowerCase() !== address?.toLowerCase()) return;
                processedTxs.add(log.transactionHash);

                const assetAddr = (log.args as any).asset as string;
                const level = Number((log.args as any).level ?? 0);
                addActivity({
                    type: 'shield',
                    description: `Shielded ${symbolFor(assetAddr)} (privacy level ${level})`,
                });
            });
        },
    } as any);

    useWatchContractEvent({
        address: OBSCURA_SHIELD_ADDRESS,
        abi: SHIELD_ABI,
        eventName: 'Unshielded',
        args: { user: address },
        enabled: !!shieldDeployed && !!address,
        onLogs(logs) {
            logs.forEach((log) => {
                if (!log.transactionHash || processedTxs.has(log.transactionHash)) return;
                if ((log.args as any).user?.toLowerCase() !== address?.toLowerCase()) return;
                processedTxs.add(log.transactionHash);

                const assetAddr = (log.args as any).asset as string;
                addActivity({
                    type: 'unshield',
                    description: `Unshielded ${symbolFor(assetAddr)}`,
                });
            });
        },
    } as any);
}
