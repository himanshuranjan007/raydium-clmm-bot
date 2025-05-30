"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPythClusterApiUrl = exports.getPythProgramKeyForCluster = void 0;
var web3_js_1 = require("@solana/web3.js");
/** Mapping from solana clusters to the public key of the pyth program. */
var clusterToPythProgramKey = {
    'mainnet-beta': 'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH',
    devnet: 'gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s',
    'pythtest-crosschain': "gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s",
    testnet: '8tfDNiaEyrV6Q1U4DEXrEigs9DoDtkugzFbybENEbCDz',
    'pythtest-conformance': '8tfDNiaEyrV6Q1U4DEXrEigs9DoDtkugzFbybENEbCDz',
    pythnet: 'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH',
    localnet: 'gMYYig2utAxVoXnM9UhtTWrt8e7x2SVBZqsWZJeT5Gw',
};
/** Gets the public key of the Pyth program running on the given cluster. */
function getPythProgramKeyForCluster(cluster) {
    if (clusterToPythProgramKey[cluster] !== undefined) {
        return new web3_js_1.PublicKey(clusterToPythProgramKey[cluster]);
    }
    else {
        throw new Error("Invalid Solana cluster name: " + cluster + ". Valid options are: " + JSON.stringify(Object.keys(clusterToPythProgramKey)));
    }
}
exports.getPythProgramKeyForCluster = getPythProgramKeyForCluster;
/** Retrieves the RPC API URL for the specified Pyth cluster  */
function getPythClusterApiUrl(cluster) {
    // TODO: Add pythnet when it's ready
    if (cluster === 'pythtest-conformance' || cluster === 'pythtest-crosschain') {
        return 'https://api.pythtest.pyth.network';
    }
    else if (cluster === 'pythnet') {
        return 'https://api2.pythnet.pyth.network';
    }
    else if (cluster === 'localnet') {
        return 'http://localhost:8899';
    }
    else {
        return web3_js_1.clusterApiUrl(cluster);
    }
}
exports.getPythClusterApiUrl = getPythClusterApiUrl;
