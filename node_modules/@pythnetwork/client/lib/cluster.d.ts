import { Cluster, PublicKey } from '@solana/web3.js';
export declare type PythCluster = Cluster | 'pythtest-conformance' | 'pythnet' | 'localnet' | 'pythtest-crosschain';
/** Gets the public key of the Pyth program running on the given cluster. */
export declare function getPythProgramKeyForCluster(cluster: PythCluster): PublicKey;
/** Retrieves the RPC API URL for the specified Pyth cluster  */
export declare function getPythClusterApiUrl(cluster: PythCluster): string;
