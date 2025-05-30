// src/bot.ts
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import Decimal from 'decimal.js';

import { config } from './config';
import logger from './logger';
import { sendDiscordNotification } from './utils/discordUtils';
import { loadWallet, getSolBalance, getTokenBalance, ensureAssociatedTokenAccount, uiAmountToAtomic, atomicAmountToUi } from './utils/solanaUtils';
import { getMarketPrices } from './utils/pythUtils';
import { getClmmPoolInfo, getOwnerPositions, calculatePriceBoundaries, openPosition, closePosition } from './services/raydiumService';
import { getSwapQuote, executeSwap } from './services/jupiterService';
import { ActivePositionInfo, PriceData, TokenBalances } from './types';
// Import Token and Percent if they are indeed used and exported. ApiClmmPoolsItem is definitely needed.
// TokenUtil and PositionUtil were causing issues, so they are removed from this import for now.
import { ApiClmmPoolsItem, Token, Percent } from '@raydium-io/raydium-sdk';


let connection: Connection;
let wallet: Keypair;
let solMint: PublicKey;
let usdcMint: PublicKey;

async function initialize() {
    logger.info('Initializing Raydium CLMM Bot...');
    connection = new Connection(config.rpcUrl, 'confirmed');
    wallet = loadWallet();
    solMint = new PublicKey(config.solMintAddress);
    usdcMint = new PublicKey(config.usdcMintAddress);

    logger.info(`Wallet Loaded: ${wallet.publicKey.toBase58()}`);
    const solBalance = await getSolBalance(connection, wallet.publicKey);
    logger.info(`Initial SOL Balance: ${atomicAmountToUi(solBalance, 9)} SOL`);

    if (solBalance < uiAmountToAtomic(config.minSolBalanceForGas, 9).toNumber()) {
        const msg = `Insufficient SOL balance (${atomicAmountToUi(solBalance,9)} SOL) for gas fees. Required: ${config.minSolBalanceForGas} SOL. Bot will not start.`;
        logger.error(msg);
        await sendDiscordNotification(msg, true);
        process.exit(1);
    }
    await ensureAssociatedTokenAccount(connection, wallet, solMint, wallet.publicKey);
    await ensureAssociatedTokenAccount(connection, wallet, usdcMint, wallet.publicKey);

    logger.info('Initialization complete.');
    await sendDiscordNotification("Raydium CLMM Bot started successfully.");
}

async function getTokenBalances(): Promise<TokenBalances> {
    const [nativeSolLamports, wSolBalanceRaw, usdcBalanceRaw] = await Promise.all([
        getSolBalance(connection, wallet.publicKey),
        getTokenBalance(connection, wallet.publicKey, solMint),
        getTokenBalance(connection, wallet.publicKey, usdcMint),
    ]);
    return {
        nativeSol: nativeSolLamports,
        sol: wSolBalanceRaw,
        usdc: usdcBalanceRaw,
    };
}

async function rebalanceTokens(
    poolInfo: ApiClmmPoolsItem,
    targetSolAmount: BN,
    targetUsdcAmount: BN,
    currentBalances: TokenBalances,
    currentPrice: number
): Promise<boolean> {
    logger.info('Checking token balances for rebalancing...');
    let rebalanced = false;

    // Explicitly type solTokenInfoSDK and usdcTokenInfoSDK using the Token type from Raydium SDK
    const mintAIsSol = new PublicKey(poolInfo.mintA).equals(solMint);
    const solTokenInfoSDK = new Token(mintAIsSol ? new PublicKey(poolInfo.mintA) : new PublicKey(poolInfo.mintB), 9, 'SOL', 'Solana');
    const usdcTokenInfoSDK = new Token(mintAIsSol ? new PublicKey(poolInfo.mintB) : new PublicKey(poolInfo.mintA), 6, 'USDC', 'USD Coin');

    const solNeeded = targetSolAmount.sub(new BN(currentBalances.sol));
    const usdcNeeded = targetUsdcAmount.sub(new BN(currentBalances.usdc));

    if (solNeeded.gt(new BN(0))) {
        const usdcToSell = solNeeded.mul(new BN(Math.floor(currentPrice * (10**usdcTokenInfoSDK.decimals)))).div(new BN(10**solTokenInfoSDK.decimals));
        if (currentBalances.usdc >= usdcToSell.toNumber() && usdcToSell.gt(new BN(0))) {
            logger.info(`Need ${atomicAmountToUi(solNeeded, solTokenInfoSDK.decimals)} SOL. Swapping ~${atomicAmountToUi(usdcToSell, usdcTokenInfoSDK.decimals)} USDC for SOL.`);
            const quote = await getSwapQuote(usdcMint, solMint, usdcToSell);
            if (quote) {
                const sig = await executeSwap(connection, wallet, quote);
                if (sig) {
                    await sendDiscordNotification(`Rebalanced: Swapped ~${atomicAmountToUi(usdcToSell, usdcTokenInfoSDK.decimals)} USDC for SOL. Tx: ${sig}`);
                    rebalanced = true;
                } else {
                     await sendDiscordNotification(`Rebalance failed: Could not execute USDC to SOL swap.`, true);
                }
            } else {
                 await sendDiscordNotification(`Rebalance failed: Could not get quote for USDC to SOL swap.`, true);
            }
        } else {
            logger.warn(`Not enough USDC to buy ${atomicAmountToUi(solNeeded, solTokenInfoSDK.decimals)} SOL for rebalancing.`);
        }
    } else if (usdcNeeded.gt(new BN(0))) {
        const solToSell = usdcNeeded.mul(new BN(10**solTokenInfoSDK.decimals)).div(new BN(Math.floor(currentPrice * (10**usdcTokenInfoSDK.decimals))));
        if (currentBalances.sol >= solToSell.toNumber() && solToSell.gt(new BN(0))) {
            logger.info(`Need ${atomicAmountToUi(usdcNeeded, usdcTokenInfoSDK.decimals)} USDC. Swapping ~${atomicAmountToUi(solToSell, solTokenInfoSDK.decimals)} SOL for USDC.`);
            const quote = await getSwapQuote(solMint, usdcMint, solToSell);
            if (quote) {
                const sig = await executeSwap(connection, wallet, quote);
                if (sig) {
                    await sendDiscordNotification(`Rebalanced: Swapped ~${atomicAmountToUi(solToSell, solTokenInfoSDK.decimals)} SOL for USDC. Tx: ${sig}`);
                    rebalanced = true;
                } else {
                     await sendDiscordNotification(`Rebalance failed: Could not execute SOL to USDC swap.`, true);
                }
            } else {
                await sendDiscordNotification(`Rebalance failed: Could not get quote for SOL to USDC swap.`, true);
            }
        } else {
            logger.warn(`Not enough SOL to buy ${atomicAmountToUi(usdcNeeded, usdcTokenInfoSDK.decimals)} USDC for rebalancing.`);
        }
    }
    if (rebalanced) logger.info("Rebalancing attempt finished.");
    else logger.info("No rebalancing needed or possible with current funds.");
    
    return rebalanced;
}


async function runBotLogic() {
    logger.info('--- Starting Bot Logic Cycle ---');
    try {
        const [currentBalances, prices, poolInfo] = await Promise.all([
            getTokenBalances(),
            getMarketPrices(),
            getClmmPoolInfo(connection, config.poolId),
        ]);

        logger.info(`Current Balances: NativeSOL=${atomicAmountToUi(currentBalances.nativeSol, 9)}, wSOL=${atomicAmountToUi(currentBalances.sol, 9)}, USDC=${atomicAmountToUi(currentBalances.usdc, 6)}`);
        logger.info(`Current Prices: SOL/USD=${prices.solUsd}`);

        if (!poolInfo) {
            logger.error('Failed to fetch CLMM pool info. Skipping cycle.');
            await sendDiscordNotification('Bot Error: Failed to fetch CLMM pool info. Check logs.', true);
            return;
        }
        
        // Explicitly type solTokenInfoSDK and usdcTokenInfoSDK
        const mintAIsSolGlobal = new PublicKey(poolInfo.mintA).equals(solMint);
        const solTokenInfoSDKGlobal = new Token(mintAIsSolGlobal ? new PublicKey(poolInfo.mintA) : new PublicKey(poolInfo.mintB), 9, 'SOL', 'Solana');
        const usdcTokenInfoSDKGlobal = new Token(mintAIsSolGlobal ? new PublicKey(poolInfo.mintB) : new PublicKey(poolInfo.mintA), 6, 'USDC', 'USD Coin');

        const existingPositions = await getOwnerPositions(connection, wallet.publicKey, new PublicKey(config.poolId));
        let activePosition: ActivePositionInfo | undefined = existingPositions.find(p => !new BN(p.liquidity).isZero());

        const currentSolPrice = prices.solUsd;
        const targetRange = calculatePriceBoundaries(currentSolPrice, config.priceRangePercentage, poolInfo);

        let needsToCreatePosition = !activePosition;

        if (activePosition) {
            logger.info(`Active position found: NFT ${activePosition.nftMint.toBase58()}, Range [${activePosition.priceLower.toFixed(4)} - ${activePosition.priceUpper.toFixed(4)}]`);
            
            const isOutOfPositionRange = currentSolPrice < activePosition.priceLower || currentSolPrice > activePosition.priceUpper;
            const oldMidPrice = (activePosition.priceLower + activePosition.priceUpper) / 2;
            const newMidPrice = (targetRange.lowerPrice.toNumber() + targetRange.upperPrice.toNumber()) / 2;
            const midPriceDrift = Math.abs(oldMidPrice - newMidPrice) / newMidPrice;
            const isStaleRange = midPriceDrift > (config.priceRangePercentage / 2);

            if (isOutOfPositionRange || isStaleRange) {
                logger.info(`Position is out of range or stale. Current Price: ${currentSolPrice.toFixed(4)}. Old Pos Range: [${activePosition.priceLower.toFixed(4)}-${activePosition.priceUpper.toFixed(4)}]. New Target: [${targetRange.lowerPrice.toFixed(4)}-${targetRange.upperPrice.toFixed(4)}]`);
                await sendDiscordNotification(`Position NFT ${activePosition.nftMint.toBase58()} is out of range/stale. Withdrawing...`);
                
                const closeSignature = await closePosition(connection, wallet, activePosition.nftMint, poolInfo, activePosition.rawPositionData);
                if (closeSignature) {
                    await sendDiscordNotification(`Successfully withdrew and closed position ${activePosition.nftMint.toBase58()}. Tx: ${closeSignature}`);
                    needsToCreatePosition = true;
                    activePosition = undefined;
                    const newBalances = await getTokenBalances();
                    currentBalances.sol = newBalances.sol;
                    currentBalances.usdc = newBalances.usdc;
                    logger.info(`Balances after withdrawal: wSOL=${atomicAmountToUi(currentBalances.sol, 9)}, USDC=${atomicAmountToUi(currentBalances.usdc, 6)}`);
                } else {
                    await sendDiscordNotification(`Failed to withdraw/close position ${activePosition.nftMint.toBase58()}. Check logs.`, true);
                }
            } else {
                logger.info('Active position is within range and not stale. No action needed.');
            }
        }

        if (needsToCreatePosition) {
            logger.info('Attempting to create a new position.');
            
            // This block was using PositionUtil and Percent which caused errors.
            // The actual amounts for openPosition are determined by availableSol/Usdc and the price range logic below.
            // Commenting out this placeholder:
            /*
            const { amountA: desiredAmountA, amountB: desiredAmountB } = PositionUtil.getAmountsFromLiquidity({
                poolInfo,
                tickLower: targetRange.lowerTick,
                tickUpper: targetRange.upperTick,
                liquidity: new BN(1000000), 
                slippage: new Percent(BigInt(config.slippageBps), BigInt(10000)), 
                add: true, 
            });
            */
            
            let amountSolToDeploy = new BN(0);
            let amountUsdcToDeploy = new BN(0);

            const availableSol = new BN(currentBalances.sol.toString()).mul(new BN(Math.floor(config.maxTokenDeployPercentage * 100))).div(new BN(100));
            const availableUsdc = new BN(currentBalances.usdc.toString()).mul(new BN(Math.floor(config.maxTokenDeployPercentage * 100))).div(new BN(100));
            
            if (currentSolPrice < targetRange.lowerPrice.toNumber()) {
                amountSolToDeploy = availableSol;
                logger.info(`Current price below target range. Deploying SOL: ${atomicAmountToUi(amountSolToDeploy, solTokenInfoSDKGlobal.decimals)}`);
            } else if (currentSolPrice > targetRange.upperPrice.toNumber()) {
                amountUsdcToDeploy = availableUsdc;
                logger.info(`Current price above target range. Deploying USDC: ${atomicAmountToUi(amountUsdcToDeploy, usdcTokenInfoSDKGlobal.decimals)}`);
            } else {
                amountSolToDeploy = availableSol;
                amountUsdcToDeploy = availableUsdc;
                 logger.info(`Current price within target range. Deploying SOL: ${atomicAmountToUi(amountSolToDeploy, solTokenInfoSDKGlobal.decimals)} and USDC: ${atomicAmountToUi(amountUsdcToDeploy, usdcTokenInfoSDKGlobal.decimals)}`);
            }

            if (amountSolToDeploy.isZero() && amountUsdcToDeploy.isZero()) {
                logger.warn('No tokens available or calculated for deployment. Skipping position creation.');
            } else {
                const nativeSolBalance = await getSolBalance(connection, wallet.publicKey);
                 if (nativeSolBalance < uiAmountToAtomic(config.minSolBalanceForGas, 9).toNumber()) {
                    const msg = `Critically low SOL balance (${atomicAmountToUi(nativeSolBalance, 9)}) before creating position. Risk of failure.`;
                    logger.warn(msg);
                    await sendDiscordNotification(msg, true);
                }

                const openSig = await openPosition(
                    connection,
                    wallet,
                    poolInfo,
                    targetRange.lowerTick,
                    targetRange.upperTick,
                    amountSolToDeploy,
                    amountUsdcToDeploy,
                    currentSolPrice
                );

                if (openSig) {
                    await sendDiscordNotification(`Successfully opened new position. Tx: ${openSig}. Range [${targetRange.lowerPrice.toFixed(4)} - ${targetRange.upperPrice.toFixed(4)}]`);
                } else {
                    await sendDiscordNotification('Failed to open new position. Check logs.', true);
                }
            }
        }

    } catch (error: any) {
        logger.error('Error in bot logic cycle:', error);
        await sendDiscordNotification(`BOT ERROR: ${error.message ? error.message.substring(0,1000) : 'Unknown error'}. Check logs.`, true);
        if (error.stack) {
            logger.error(error.stack);
        }
    } finally {
        logger.info('--- Finished Bot Logic Cycle ---');
        const finalNativeSol = await getSolBalance(connection, wallet.publicKey);
        logger.info(`Native SOL balance post-cycle: ${atomicAmountToUi(finalNativeSol, 9)} SOL`);
        if (finalNativeSol < uiAmountToAtomic(config.minSolBalanceForGas, 9).mul(new BN(2)).toNumber()) {
            const msg = `Warning: Native SOL balance is low: ${atomicAmountToUi(finalNativeSol, 9)} SOL. Please top up.`;
            logger.warn(msg);
            await sendDiscordNotification(msg, false);
        }
    }
}

async function main() {
    await initialize();
    runBotLogic().catch(e => logger.error("Unhandled error in initial runBotLogic:", e));
    setInterval(() => {
        runBotLogic().catch(e => logger.error("Unhandled error in scheduled runBotLogic:", e));
    }, config.checkIntervalMs);
}

main().catch(async (err) => {
    logger.error('Unhandled error in main:', err);
    await sendDiscordNotification(`CRITICAL BOT FAILURE: ${err.message}. Bot shutting down.`, true);
    process.exit(1);
});