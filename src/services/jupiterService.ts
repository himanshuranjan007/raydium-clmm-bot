import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { QuoteResponse, SwapMode, createJupiterApiClient } from '@jup-ag/api';
import { config } from '../config';
import logger from '../logger';
import { sendAndConfirmTransactionWrapper } from '../utils/solanaUtils';
import BN from 'bn.js';


const jupiterApi = createJupiterApiClient(); // Uses default JUPITER_API_ENDPOINT if not overridden

export async function getSwapQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: BN, // Amount in smallest unit
    swapMode: SwapMode = SwapMode.ExactIn
): Promise<QuoteResponse | null> {
    try {
        logger.info(`Getting Jupiter quote: ${amount.toString()} of ${inputMint.toBase58()} to ${outputMint.toBase58()}`);
        const quote = await jupiterApi.quoteGet({
            inputMint: inputMint.toBase58(),
            outputMint: outputMint.toBase58(),
            amount: amount.toNumber(), // Jupiter API expects number for amount
            slippageBps: config.slippageBps,
            swapMode,
            // platformFeeBps: 0, // Optional: if you want to add platform fees
        });
        if (!quote) {
            logger.warn('No Jupiter quote found for the given parameters.');
            return null;
        }
        logger.info(`Jupiter quote received: ${quote.outAmount} of ${outputMint.toBase58()} for ${quote.inAmount} of ${inputMint.toBase58()}`);
        return quote;
    } catch (error) {
        logger.error('Error getting Jupiter swap quote:', error);
        throw error;
    }
}

export async function executeSwap(
    connection: Connection,
    wallet: Keypair,
    quoteResponse: QuoteResponse
): Promise<string | null> {
    try {
        logger.info(`Executing Jupiter swap for quote: ${quoteResponse.inAmount} -> ${quoteResponse.outAmount}`);
        // Get serialized transaction
        const { swapTransaction } = await jupiterApi.swapPost({
            swapRequest: {
                quoteResponse,
                userPublicKey: wallet.publicKey.toBase58(),
                wrapAndUnwrapSol: true, // Automatically wraps/unwraps SOL if needed
                // dynamicComputeUnitLimit: true, // for priority fees
            }
        });

        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
        
        logger.info('Signing and sending swap transaction...');
        // Sign the transaction
        transaction.sign([wallet]); // Jupiter SDK transactions are usually versioned

        const signature = await sendAndConfirmTransactionWrapper(connection, transaction, [wallet], true); // skipPreflight often needed for Jupiter
        
        logger.info(`Swap successful! Transaction signature: ${signature}`);
        return signature;

    } catch (error: any) {
        logger.error('Error executing Jupiter swap:');
        if (error.response?.data) { // Log Jupiter API error details
            logger.error(JSON.stringify(error.response.data, null, 2));
        } else {
            logger.error(error);
        }
        throw error;
    }
}