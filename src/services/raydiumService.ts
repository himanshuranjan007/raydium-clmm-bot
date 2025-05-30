import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
    Clmm,
    ClmmPoolInfo,
    ClmmPersonalPosition,
    PositionUtil,
    PriceMath,
    TickMath,
    TokenUtil,
    TxVersion,
    buildAndSendTx,
    LiquidityMath,
    PoolUtil,
    resolvePoolKeys, // New way to get pool keys
    DEVNET_PROGRAM_ID,
    MAINNET_PROGRAM_ID,
    ReturnTypeFetchMultiplePoolTickArrays,
    ApiClmmPoolsItem,
    Percent,
    Token,
    TokenAmount,
    Price
} from '@raydium-io/raydium-sdk';
import BN from 'bn.js';
import Decimal from 'decimal.js';
import { config } from '../config';
import logger from '../logger';
import { sendAndConfirmTransactionWrapper, uiAmountToAtomic, atomicAmountToUi } from '../utils/solanaUtils';
import { ActivePositionInfo } from '../types';

// Use the correct program ID based on your target (mainnet/devnet)
const CLMM_PROGRAM_ID = new PublicKey(config.targetPoolProgramId); // CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK
const RAYDIUM_MAINNET_PROGRAM_ID = MAINNET_PROGRAM_ID; // Use appropriate Raydium program IDs

// Helper function to get full pool info including tick arrays
async function getFullPoolInfo(connection: Connection, poolId: PublicKey): Promise<ApiClmmPoolsItem | null> {
    try {
        // The SDK might have a direct fetch function, or you might need to use their API endpoint
        // For now, let's assume we can fetch basic info and then tick arrays
        // This part highly depends on how Raydium wants you to fetch full pool details for SDK v2
        
        // First, try to resolve pool keys. This will give basic info.
        const poolKeys = await resolvePoolKeys({ connection, programId: CLMM_PROGRAM_ID, poolId });
        if (!poolKeys) {
            logger.error(`Could not resolve pool keys for ${poolId.toBase58()}`);
            return null;
        }

        // Fetch the dynamic data for the pool using Clmm.fetchMultiplePoolInfos
        const { [poolId.toBase58()]: poolInfo } = await Clmm.fetchMultiplePoolInfos({
            connection,
            poolKeys: [poolKeys],
            chainTime: Math.floor(Date.now() / 1000), // Current epoch time
            batchRequest: true, // Use batch request if available and suitable
        });
        
        if (!poolInfo) {
            logger.error(`Could not fetch CLMM pool info for ${poolId.toBase58()}`);
            return null;
        }

        // Fetch tick arrays - this is crucial for price calculations and position management
        // This might be intensive if not done correctly or batched
        const tickArrays = await Clmm.fetchMultiplePoolTickArrays({
            connection,
            poolKeys: [poolKeys],
            batchRequest: true,
        });
        
        poolInfo.tickArrayBitmap = tickArrays[poolId.toBase58()].tickArrayBitmap;
        poolInfo.tickArrays = tickArrays[poolId.toBase58()].tickArrays;
        

        logger.info(`Fetched full pool info for ${poolId.toBase58()}`);
        // The 'poolInfo' here is of type ApiClmmPoolsItem from the SDK
        return poolInfo;

    } catch (error) {
        logger.error(`Error fetching full CLMM pool info for ${poolId.toBase58()}:`, error);
        throw error;
    }
}


export async function getClmmPoolInfo(connection: Connection, poolIdStr: string): Promise<ApiClmmPoolsItem | null> {
    const poolId = new PublicKey(poolIdStr);
    return getFullPoolInfo(connection, poolId);
}

export async function getOwnerPositions(
    connection: Connection,
    owner: PublicKey,
    poolId?: PublicKey // Optional: filter by pool
): Promise<ActivePositionInfo[]> {
    try {
        const personalPositions = await Clmm.fetchMultipleOwnerPositionByOwner({
            connection,
            owner,
            programId: CLMM_PROGRAM_ID
        });

        if (!personalPositions || personalPositions.length === 0) {
            logger.info(`No CLMM positions found for owner ${owner.toBase58()}`);
            return [];
        }
        
        const activePositions: ActivePositionInfo[] = [];
        for (const pos of personalPositions) {
            if (poolId && !pos.poolId.equals(poolId)) {
                continue; // Skip if not the target pool
            }
            if (pos.liquidity.isZero()) { // Skip positions with no liquidity
                continue;
            }

            // Need pool info to convert ticks to prices
            const poolInfo = await getFullPoolInfo(connection, pos.poolId);
            if (!poolInfo) {
                logger.warn(`Could not get pool info for position ${pos.nftMint.toBase58()}, skipping price conversion.`);
                // Fallback or skip, here we skip advanced info
                 activePositions.push({
                    nftMint: pos.nftMint,
                    liquidity: pos.liquidity.toString(),
                    tickLower: pos.tickLower,
                    tickUpper: pos.tickUpper,
                    priceLower: 0, // Placeholder
                    priceUpper: 0, // Placeholder
                    rawPositionData: pos,
                });
                continue;
            }

            const priceLower = PriceMath.tickPrice({
                poolInfo, // Needs full pool info with tick arrays
                tick: pos.tickLower,
                baseIn: poolInfo.mintA.mint.equals(new PublicKey(config.solMintAddress)) // true if SOL is mintA (base)
            });
            const priceUpper = PriceMath.tickPrice({
                poolInfo,
                tick: pos.tickUpper,
                baseIn: poolInfo.mintA.mint.equals(new PublicKey(config.solMintAddress))
            });


            activePositions.push({
                nftMint: pos.nftMint,
                liquidity: pos.liquidity.toString(), // BN to string
                tickLower: pos.tickLower,
                tickUpper: pos.tickUpper,
                priceLower: priceLower.price.toNumber(),
                priceUpper: priceUpper.price.toNumber(),
                rawPositionData: pos,
            });
        }
        logger.info(`Found ${activePositions.length} active CLMM positions for ${owner.toBase58()}${poolId ? ` in pool ${poolId.toBase58()}` : ''}.`);
        return activePositions;
    } catch (error) {
        logger.error('Error fetching owner CLMM positions:', error);
        throw error;
    }
}

export function calculatePriceBoundaries(
    currentPrice: number,
    rangePercentage: number,
    poolInfo: ApiClmmPoolsItem
): { lowerPrice: Decimal; upperPrice: Decimal; lowerTick: number; upperTick: number } {
    const currentPriceDecimal = new Decimal(currentPrice);
    const range = currentPriceDecimal.mul(rangePercentage);

    let lowerPrice = currentPriceDecimal.sub(range);
    let upperPrice = currentPriceDecimal.add(range);

    // Ensure lowerPrice is not negative or zero
    if (lowerPrice.lessThanOrEqualTo(0)) {
        lowerPrice = new Decimal(TickMath.MIN_PRICE_X64_BN.toString()).div(new Decimal(2).pow(64)); // Smallest possible price
    }
    
    // Determine baseIn based on pool's mintA and mintB configuration
    // Assuming SOL is token A (base) and USDC is token B (quote) for SOL/USDC price
    const baseIn = poolInfo.mintA.mint.equals(new PublicKey(config.solMintAddress));

    // Convert prices to ticks, respecting tickSpacing
    // The price from Pyth is SOL/USD. If pool is SOL/USDC, it's fine.
    // If pool is USDC/SOL, invert the price before converting to tick.
    // This example assumes pool is SOL (mintA) / USDC (mintB) or vice-versa and Pyth price matches base token.

    let lowerTick = PriceMath.priceToTick({ poolInfo, price: new Price(baseIn ? poolInfo.mintA : poolInfo.mintB, baseIn ? poolInfo.mintB : poolInfo.mintA, lowerPrice.toSD(poolInfo.mintB.decimals), new Decimal(1)), baseIn });
    let upperTick = PriceMath.priceToTick({ poolInfo, price: new Price(baseIn ? poolInfo.mintA : poolInfo.mintB, baseIn ? poolInfo.mintB : poolInfo.mintA, upperPrice.toSD(poolInfo.mintB.decimals), new Decimal(1)), baseIn });
    
    // Ensure ticks are multiples of tickSpacing
    lowerTick = Math.floor(lowerTick / poolInfo.tickSpacing) * poolInfo.tickSpacing;
    upperTick = Math.ceil(upperTick / poolInfo.tickSpacing) * poolInfo.tickSpacing;

    // Ensure tick order and bounds
    if (lowerTick >= upperTick) { // Should not happen with correct price range
        upperTick = lowerTick + poolInfo.tickSpacing; // Ensure upper is at least one tick_spacing away
    }
    lowerTick = Math.max(lowerTick, TickMath.MIN_TICK_INDEX);
    upperTick = Math.min(upperTick, TickMath.MAX_TICK_INDEX);
    
    // Recalculate price from adjusted ticks for accuracy
    const finalLowerPriceSDK = PriceMath.tickPrice({ poolInfo, tick: lowerTick, baseIn });
    const finalUpperPriceSDK = PriceMath.tickPrice({ poolInfo, tick: upperTick, baseIn });


    logger.info(`Calculated price boundaries: Current=${currentPriceDecimal.toFixed(6)}, Range=${rangePercentage*100}%`);
    logger.info(`  Lower: Tick=${lowerTick}, Price=${finalLowerPriceSDK.price.toFixed(6)}`);
    logger.info(`  Upper: Tick=${upperTick}, Price=${finalUpperPriceSDK.price.toFixed(6)}`);

    return {
        lowerPrice: finalLowerPriceSDK.price, // Use Decimal from SDK's Price object
        upperPrice: finalUpperPriceSDK.price,
        lowerTick,
        upperTick,
    };
}

export async function openPosition(
    connection: Connection,
    wallet: Keypair,
    poolInfo: ApiClmmPoolsItem,
    lowerTick: number,
    upperTick: number,
    amountSolRaw: BN, // wSOL amount in lamports
    amountUsdcRaw: BN, // USDC amount in smallest unit
    currentSolUsdPrice: number
): Promise<string | null> {
    try {
        logger.info(`Attempting to open position with SOL: ${atomicAmountToUi(amountSolRaw, 9)}, USDC: ${atomicAmountToUi(amountUsdcRaw, 6)}`);
        logger.info(`  Range: Tick ${lowerTick} to ${upperTick}`);

        const owner = wallet.publicKey;
        const { tickSpacing, mintA, mintB, id: poolId } = poolInfo;

        // Determine which token is base (mintA) vs quote (mintB) for the SDK
        // This example assumes mintA is SOL, mintB is USDC based on your .env config
        // Adjust if your pool has a different order
        const tokenAIsSol = mintA.mint.equals(new PublicKey(config.solMintAddress));
        const tokenAMint = tokenAIsSol ? mintA.mint : mintB.mint;
        const tokenBMint = tokenAIsSol ? mintB.mint : mintA.mint;
        const tokenAAmount = tokenAIsSol ? amountSolRaw : amountUsdcRaw;
        const tokenBAmount = tokenAIsSol ? amountUsdcRaw : amountSolRaw;
        const tokenADecimals = tokenAIsSol ? mintA.decimals : mintB.decimals;
        const tokenBDecimals = tokenAIsSol ? mintB.decimals : mintA.decimals;

        const baseIn = tokenAIsSol; // If SOL is base (token A)
        const priceLowerSDK = PriceMath.tickPrice({ poolInfo, tick: lowerTick, baseIn });
        const priceUpperSDK = PriceMath.tickPrice({ poolInfo, tick: upperTick, baseIn });
        
        // Calculate liquidity based on one of the tokens (or both if in range)
        // This logic determines how much of tokenA and tokenB are *actually* needed for the chosen range and amounts
        // The SDK should provide a way to calculate liquidity from amounts OR amounts from liquidity.
        // We have amounts, so we need to calculate the liquidity `L` that can be formed.
        
        // `Clmm.computePositionAmount` is used to determine the amounts needed for a given liquidity `L` and price range.
        // We need the reverse: given amounts and price range, what is `L` and what are the *actual* amounts used.

        // Strategy: Use the token that is "scarcer" relative to the price range to fix liquidity.
        // Or, more simply, try to add all of tokenA, and see how much tokenB is needed, and vice versa.
        // Then pick the one that uses less than or equal to available.

        let liquidity = new BN(0);
        let actualAmountA = new BN(0);
        let actualAmountB = new BN(0);

        const currentPriceSDK = PriceMath.priceToTick({ poolInfo, price: new Price(mintA, mintB, new Decimal(currentSolUsdPrice), new Decimal(1)), baseIn })

        if (tokenAAmount.gt(new BN(0)) && tokenBAmount.gt(new BN(0))) {
            // Both tokens provided, SDK should handle computing L and how much of each is used.
            // This is the ideal case when current price is within the range.
            liquidity = LiquidityMath.getLiquidityFromAmounts({
                currentPrice: new BN(currentPriceSDK), // tick of current price
                lowerPrice: new BN(lowerTick), // tick lower
                upperPrice: new BN(upperTick), // tick upper
                amountA: tokenAAmount,
                amountB: tokenBAmount,
                amountAIsCryptoNative: true, // Assuming amountA is the crypto native token if SOL
                amountBIsCryptoNative: false,
            });
             const amounts = LiquidityMath.getAmountsForLiquidity({
                currentPrice: new BN(currentPriceSDK),
                lowerPrice: new BN(lowerTick),
                upperPrice: new BN(upperTick),
                liquidity,
                liquidityIsCryptoNative: true, // adjust as needed
            });
            actualAmountA = amounts.amountA;
            actualAmountB = amounts.amountB;

        } else if (tokenAAmount.gt(new BN(0))) { // Only Token A (e.g. SOL)
            liquidity = LiquidityMath.getLiquidityFromAmountA({
                amount: tokenAAmount,
                // Provide current price as tick, and range ticks
                // This depends on whether current price is below, in, or above range
                // simplified:
                sqrtPriceX64A: PriceMath.priceToSqrtPriceX64({ poolInfo, price: priceLowerSDK.price, baseIn }),
                sqrtPriceX64B: PriceMath.priceToSqrtPriceX64({ poolInfo, price: priceUpperSDK.price, baseIn }),
                isCryptoNative: true
            });
            actualAmountA = tokenAAmount;
            actualAmountB = LiquidityMath.getAmountBFromLiquidity({
                liquidity,
                // sqrt prices
                sqrtPriceX64A: PriceMath.priceToSqrtPriceX64({ poolInfo, price: priceLowerSDK.price, baseIn }),
                sqrtPriceX64B: PriceMath.priceToSqrtPriceX64({ poolInfo, price: priceUpperSDK.price, baseIn }),
                roundUp: true,
                isCryptoNative: false
            });

        } else if (tokenBAmount.gt(new BN(0))) { // Only Token B (e.g. USDC)
             liquidity = LiquidityMath.getLiquidityFromAmountB({
                amount: tokenBAmount,
                sqrtPriceX64A: PriceMath.priceToSqrtPriceX64({ poolInfo, price: priceLowerSDK.price, baseIn }),
                sqrtPriceX64B: PriceMath.priceToSqrtPriceX64({ poolInfo, price: priceUpperSDK.price, baseIn }),
                isCryptoNative: false
            });
            actualAmountB = tokenBAmount;
            actualAmountA = LiquidityMath.getAmountAFromLiquidity({
                liquidity,
                sqrtPriceX64A: PriceMath.priceToSqrtPriceX64({ poolInfo, price: priceLowerSDK.price, baseIn }),
                sqrtPriceX64B: PriceMath.priceToSqrtPriceX64({ poolInfo, price: priceUpperSDK.price, baseIn }),
                roundUp: true,
                isCryptoNative: true
            });
        }

        if (liquidity.isZero() || actualAmountA.isZero() && actualAmountB.isZero()) {
            logger.warn('Calculated zero liquidity or zero amounts. Cannot open position.');
            return null;
        }

        logger.info(`Calculated Liquidity: ${liquidity.toString()}`);
        logger.info(`  Actual amounts to be used: TokenA (SOL): ${atomicAmountToUi(actualAmountA, tokenADecimals)}, TokenB (USDC): ${atomicAmountToUi(actualAmountB, tokenBDecimals)}`);

        if (actualAmountA.gt(tokenAAmount) || actualAmountB.gt(tokenBAmount)) {
            logger.error('Calculated amounts exceed available. This indicates a math or logic error.');
            logger.error(`Available: SOL ${atomicAmountToUi(tokenAAmount, tokenADecimals)}, USDC ${atomicAmountToUi(tokenBAmount, tokenBDecimals)}`);
            logger.error(`Required: SOL ${atomicAmountToUi(actualAmountA, tokenADecimals)}, USDC ${atomicAmountToUi(actualAmountB, tokenBDecimals)}`);
            return null; // Safety break
        }
        
        const { transaction, address } = await Clmm.makeOpenPositionTransaction({
            connection,
            poolInfo,
            ownerInfo: {
                wallet: owner,
                tokenAccountA: getAssociatedTokenAddressSync(tokenAMint, owner, true),
                tokenAccountB: getAssociatedTokenAddressSync(tokenBMint, owner, true),
                // newPositionNftMint, newPositionNftAccount will be created
            },
            tickLower,
            tickUpper,
            liquidity, // The calculated liquidity
            amountMaxA: new TokenAmount(new Token(tokenAMint, tokenADecimals), actualAmountA, true),
            amountMaxB: new TokenAmount(new Token(tokenBMint, tokenBDecimals), actualAmountB, true),
            checkCreateATAOwner: true, // Let SDK handle ATA creation if needed
            // fee: undefined, // Optional: for priority fees
            // computeBudgetConfig: { units: 400000, microLamports: 25000 }, // Optional compute budget
            makeTxVersion: TxVersion.V0, // Use Versioned Transactions
            associatedPosition prédéfini: undefined,
        });

        // The `transaction` here is likely a `TransactionBuilder` or similar
        // It needs to be converted to a sendable Solana transaction
        const txSignature = await buildAndSendTx(transaction, { owner: wallet, checkLiquidTx: false, skipPreflight: true });

        logger.info(`Opened new CLMM position. NFT Mint: ${address.nftMint.toBase58()}, Tx: ${txSignature}`);
        return txSignature;

    } catch (error) {
        logger.error('Error opening CLMM position:', error);
        if ((error as any).logs) {
            logger.error("Transaction logs:", (error as any).logs);
        }
        throw error;
    }
}


export async function closePosition(
    connection: Connection,
    wallet: Keypair,
    positionNftMint: PublicKey,
    poolInfo: ApiClmmPoolsItem, // Need this to correctly decrease liquidity
    personalPosition: ClmmPersonalPosition // Pass the full personal position object
): Promise<string | null> {
    try {
        logger.info(`Attempting to close position NFT: ${positionNftMint.toBase58()}`);
        const owner = wallet.publicKey;

        // 1. Decrease Liquidity (withdraw all)
        // The SDK now requires the personalPosition object to be passed
        const { transaction: decreaseLiqTxBuilder } = await Clmm.makeDecreaseLiquidityTransaction({
            connection,
            poolInfo, // Full pool info
            ownerInfo: {
                wallet: owner,
                positionNftMint: positionNftMint, // The NFT of the position
                // ATA for receiving tokens A and B
                tokenAccountA: getAssociatedTokenAddressSync(poolInfo.mintA.mint, owner, true),
                tokenAccountB: getAssociatedTokenAddressSync(poolInfo.mintB.mint, owner, true),
            },
            personalPosition, // The personal position object from fetchMultipleOwnerPositionByOwner
            liquidity: personalPosition.liquidity, // Withdraw all liquidity
            amountMinA: new TokenAmount(poolInfo.mintA, new BN(0)), // Expect at least 0 (no slippage control here, but could be set)
            amountMinB: new TokenAmount(poolInfo.mintB, new BN(0)),
            // computeBudgetConfig, makeTxVersion, etc.
            makeTxVersion: TxVersion.V0,
        });
        
        const decreaseLiqTxId = await buildAndSendTx(decreaseLiqTxBuilder, { owner: wallet, checkLiquidTx: false, skipPreflight: true });
        logger.info(`Decreased liquidity for position ${positionNftMint.toBase58()}. Tx: ${decreaseLiqTxId}`);

        // 2. Close the position account and burn NFT
        const { transaction: closePosTxBuilder } = await Clmm.makeClosePositionTransaction({
            connection,
            ownerInfo: {
                wallet: owner,
                positionNftMint: positionNftMint, // The NFT of the position
                // No need for token accounts here as liquidity is already withdrawn
            },
            personalPosition, // Pass the personal position object again
            // computeBudgetConfig, makeTxVersion, etc.
            makeTxVersion: TxVersion.V0,
        });

        const closePosTxId = await buildAndSendTx(closePosTxBuilder, { owner: wallet, checkLiquidTx: false, skipPreflight: true });
        logger.info(`Closed position account for NFT ${positionNftMint.toBase58()}. Tx: ${closePosTxId}`);
        
        return closePosTxId; // Return the signature of the close instruction

    } catch (error) {
        logger.error(`Error closing CLMM position ${positionNftMint.toBase58()}:`, error);
        if ((error as any).logs) {
            logger.error("Transaction logs:", (error as any).logs);
        }
        throw error;
    }
}