import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction as realSendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
    SystemProgram,
    VersionedTransaction,
    TransactionMessage,
    AddressLookupTableAccount,
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getAccount,
    createAssociatedTokenAccountInstruction,
    Account as TokenAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { config } from '../config';
import logger from '../logger';
import BN from 'bn.js';

export function loadWallet(): Keypair {
    try {
        return Keypair.fromSecretKey(bs58.decode(config.privateKeyBs58));
    } catch (error) {
        logger.error('Failed to load wallet from private key. Ensure PRIVATE_KEY_BS58 is correct.');
        throw error;
    }
}

export async function getSolBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
    return connection.getBalance(publicKey);
}

export async function getTokenBalance(
    connection: Connection,
    owner: PublicKey,
    mint: PublicKey
): Promise<number> {
    const tokenAccountPubkey = getAssociatedTokenAddressSync(mint, owner, true); // allowOwnerOffCurve = true
    try {
        const tokenAccountInfo = await getAccount(connection, tokenAccountPubkey);
        return Number(tokenAccountInfo.amount);
    } catch (e) {
        // If account not found, balance is 0
        if ((e as Error).message.includes("could not find account") || (e as Error).message.includes("Account does not exist")) {
            return 0;
        }
        logger.error(`Error fetching token balance for ${mint.toBase58()} at ${tokenAccountPubkey.toBase58()}:`, e);
        throw e;
    }
}

export async function ensureAssociatedTokenAccount(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    owner: PublicKey
): Promise<PublicKey> {
    const associatedTokenAddress = getAssociatedTokenAddressSync(mint, owner, true);

    try {
        await getAccount(connection, associatedTokenAddress);
        logger.info(`ATA ${associatedTokenAddress.toBase58()} for mint ${mint.toBase58()} already exists.`);
        return associatedTokenAddress;
    } catch (error: any) {
        // Account does not exist, create it
        if (error.message.includes('could not find account') || error.message.includes('Account does not exist')) {
            logger.info(`ATA ${associatedTokenAddress.toBase58()} for mint ${mint.toBase58()} not found. Creating...`);
            const transaction = new Transaction().add(
                createAssociatedTokenAccountInstruction(
                    payer.publicKey,
                    associatedTokenAddress,
                    owner,
                    mint
                )
            );
            await sendAndConfirmTransactionWrapper(connection, transaction, [payer]);
            logger.info(`Created ATA ${associatedTokenAddress.toBase58()}`);
            return associatedTokenAddress;
        } else {
            throw error;
        }
    }
}


export async function sendAndConfirmTransactionWrapper(
    connection: Connection,
    transaction: Transaction | VersionedTransaction,
    signers: Keypair[],
    skipPreflight: boolean = false,
    lookupTableAccounts?: AddressLookupTableAccount[]
): Promise<string> {
    let tx = transaction;
    if (transaction instanceof Transaction) {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = signers[0].publicKey;
        // For versioned transactions, signers might be applied differently or message pre-signed
    }

    // For VersionedTransaction, it needs to be signed before sending.
    // The SDK often returns TransactionBuilder which might build VersionedTransaction.
    if (tx instanceof VersionedTransaction) {
        tx.sign(signers); // Sign with all required signers
    } else {
         // For legacy Transaction, partialSign or sign can be used.
        // If signers are provided, they are applied here.
        // Often Raydium SDK might pre-sign with some internal accounts if instructions require it.
        tx.sign(...signers);
    }


    const rawTransaction = tx.serialize();
    const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: skipPreflight,
        maxRetries: 5,
    });

    logger.info(`Transaction sent with signature: ${signature}. Waiting for confirmation...`);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const confirmation = await connection.confirmTransaction(
        {
            signature,
            blockhash,
            lastValidBlockHeight,
        },
        'confirmed'
    );

    if (confirmation.value.err) {
        logger.error('Transaction failed:', confirmation.value.err);
        logger.error('Transaction logs:', await connection.getConfirmedTransaction(signature, 'confirmed'));
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    logger.info(`Transaction confirmed: ${signature}`);
    return signature;
}

// Helper to convert UI amount to smallest unit (lamports for SOL, basis points for USDC)
export function uiAmountToAtomic(amount: number, decimals: number): BN {
    // Use string representation to avoid floating point inaccuracies
    const amountStr = amount.toFixed(decimals);
    const [integerPart, fractionalPart = ''] = amountStr.split('.');
    const atomicAmountStr = integerPart + (fractionalPart + '0'.repeat(decimals)).substring(0, decimals);
    return new BN(atomicAmountStr);
}

export function atomicAmountToUi(amount: BN | number, decimals: number): number {
    const bnAmount = BN.isBN(amount) ? amount : new BN(amount.toString()); // Ensure it's a BN
    const factor = new BN(10).pow(new BN(decimals));
    const integralPart = bnAmount.div(factor);
    const fractionalPart = bnAmount.mod(factor);

    // Pad fractional part with leading zeros if necessary
    const fractionalString = fractionalPart.toString(10).padStart(decimals, '0');
    return parseFloat(`${integralPart.toString(10)}.${fractionalString}`);
}