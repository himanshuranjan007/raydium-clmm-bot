import { Connection, PublicKey } from '@solana/web3.js';
import { PythHttpClient, getPythProgramKeyForCluster } from '@pythnetwork/client';
import { config } from '../config';
import logger from '../logger';
import { PriceData } from '../types';

const pythClient = new PythHttpClient(new Connection(config.rpcUrl), getPythProgramKeyForCluster('mainnet-beta'));

export async function getMarketPrices(): Promise<PriceData> {
    try {
        const data = await pythClient.getData();
        const solPriceData = data.productPrice.get(config.pythSolUsdPriceFeedId);

        if (!solPriceData || typeof solPriceData.price !== 'number') {
            throw new Error(`SOL/USD price not available from Pyth feed ${config.pythSolUsdPriceFeedId}`);
        }
        
        // Assuming USDC is stable at $1 for simplicity in SOL/USDC context from SOL/USD
        // If a direct SOL/USDC feed exists and is preferred, use that.
        // Or if USDC/USD feed is needed for more precision, fetch that too.
        const solUsd = solPriceData.price;

        logger.info(`Fetched prices: SOL/USD = ${solUsd}`);
        return { solUsd };

    } catch (error) {
        logger.error('Error fetching Pyth prices:', error);
        throw error;
    }
}