import { Commitment, Connection, PublicKey } from '@solana/web3.js';
import { Product, PriceData, PermissionData } from '.';
export interface PythHttpClientResult {
    assetTypes: string[];
    /** The name of each product, e.g., "Crypto.BTC/USD" */
    symbols: string[];
    products: Product[];
    /** Metadata for each product. */
    productFromSymbol: Map<string, Product>;
    /** The current price of each product. */
    productPrice: Map<string, PriceData>;
    prices: PriceData[];
    permissionData: PermissionData | undefined;
}
/**
 * Reads Pyth price data from a solana web3 connection. This class uses a single HTTP call.
 * Use the method getData() to get updated prices values.
 */
export declare class PythHttpClient {
    connection: Connection;
    pythProgramKey: PublicKey;
    commitment: Commitment;
    constructor(connection: Connection, pythProgramKey: PublicKey, commitment?: Commitment);
    getData(): Promise<PythHttpClientResult>;
    /**
     * Get the price state for an array of specified price accounts.
     * The result is the price state for the given assets if they exist, throws if at least one account does not exist.
     */
    getAssetPricesFromAccounts(priceAccounts: PublicKey[]): Promise<PriceData[]>;
}
