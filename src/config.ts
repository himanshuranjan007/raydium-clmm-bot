import dotenv from 'dotenv';
import { BotConfig } from './types';

dotenv.config();

function getEnvVar(name: string, required: boolean = true): string {
    const val = process.env[name];
    if (required && !val) {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return val || '';
}

export const config: BotConfig = {
    rpcUrl: getEnvVar('RPC_URL'),
    privateKeyBs58: getEnvVar('PRIVATE_KEY_BS58'),
    minSolBalanceForGas: parseFloat(getEnvVar('MIN_SOL_BALANCE_FOR_GAS', true)),
    poolId: getEnvVar('POOL_ID'),
    targetPoolProgramId: getEnvVar('TARGET_POOL_PROGRAM_ID'),
    priceRangePercentage: parseFloat(getEnvVar('PRICE_RANGE_PERCENTAGE', true)),
    checkIntervalMs: parseInt(getEnvVar('CHECK_INTERVAL_MS', true), 10),
    slippageBps: parseInt(getEnvVar('SLIPPAGE_BPS', true), 10),
    maxTokenDeployPercentage: parseFloat(getEnvVar('MAX_TOKEN_DEPLOY_PERCENTAGE', true)),
    solMintAddress: getEnvVar('SOL_MINT_ADDRESS'),
    usdcMintAddress: getEnvVar('USDC_MINT_ADDRESS'),
    pythSolUsdPriceFeedId: getEnvVar('PYTH_SOL_USD_PRICE_FEED_ID'),
    discordWebhookUrl: getEnvVar('DISCORD_WEBHOOK_URL', false) || undefined,
};