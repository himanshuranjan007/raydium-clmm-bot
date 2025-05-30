import { Connection, PublicKey, Commitment, AccountInfo } from '@solana/web3.js';
import { PriceData, Product, ProductData } from './index';
/** An update to the content of the solana account at `key` that occurred at `slot`. */
export declare type AccountUpdate<T> = {
    key: PublicKey;
    accountInfo: AccountInfo<T>;
    slot: number;
};
/**
 * Type of callback invoked whenever a pyth price account changes. The callback additionally
 * gets `product`, which contains the metadata for this price account (e.g., that the symbol is "BTC/USD")
 */
export declare type PythPriceCallback = (product: Product, price: PriceData) => void;
/**
 * A price callback that additionally includes the raw solana account information. Use this if you need
 * access to account keys and such.
 */
export declare type PythVerbosePriceCallback = (product: AccountUpdate<ProductData>, price: AccountUpdate<PriceData>) => void;
/**
 * Reads Pyth price data from a solana web3 connection. This class uses a callback-driven model,
 * similar to the solana web3 methods for tracking updates to accounts.
 */
export declare class PythConnection {
    connection: Connection;
    pythProgramKey: PublicKey;
    commitment: Commitment;
    feedIds?: PublicKey[];
    productAccountKeyToProduct: Record<string, AccountUpdate<ProductData>>;
    priceAccountKeyToProductAccountKey: Record<string, string>;
    callbacks: PythVerbosePriceCallback[];
    private handleProductAccount;
    private handlePriceAccount;
    private handleAccount;
    /** Create a PythConnection that reads its data from an underlying solana web3 connection.
     *  pythProgramKey is the public key of the Pyth program running on the chosen solana cluster.
     */
    constructor(connection: Connection, pythProgramKey: PublicKey, commitment?: Commitment, feedIds?: PublicKey[]);
    /** Start receiving price updates. Once this method is called, any registered callbacks will be invoked
     *  each time a Pyth price account is updated.
     */
    start(): Promise<void>;
    /** Register callback to receive price updates. */
    onPriceChange(callback: PythPriceCallback): void;
    /** Register a verbose callback to receive price updates. */
    onPriceChangeVerbose(callback: PythVerbosePriceCallback): void;
    /** Stop receiving price updates. Note that this also currently deletes all registered callbacks. */
    stop(): Promise<void>;
}
