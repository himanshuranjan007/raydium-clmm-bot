import { PublicKey } from '@solana/web3.js';
import { ClmmPersonalPosition } from '@raydium-io/raydium-sdk'; // Adjust if type name is different

export interface BotConfig {
    rpcUrl: string;
    privateKeyBs58: string;
    minSolBalanceForGas: number;
    poolId: string;
    targetPoolProgramId: string;
    priceRangePercentage: number;
    checkIntervalMs: number;
    slippageBps: number;
    maxTokenDeployPercentage: number;
    solMintAddress: string;
    usdcMintAddress: string;
    pythSolUsdPriceFeedId: string;
    discordWebhookUrl?: string;
}

export interface TokenBalances {
    sol: number; // Lamports
    usdc: number; // Smallest unit of USDC
    nativeSol: number; // Lamports for gas
}

export interface PriceData {
    solUsd: number;
}

// Raydium SDK might have more specific types for positions
export interface ActivePositionInfo {
    nftMint: PublicKey;
    liquidity: string; // Using string for BN compatibility
    tickLower: number;
    tickUpper: number;
    priceLower: number;
    priceUpper: number;
    rawPositionData: ClmmPersonalPosition; // Store the raw SDK position data
}ˀ