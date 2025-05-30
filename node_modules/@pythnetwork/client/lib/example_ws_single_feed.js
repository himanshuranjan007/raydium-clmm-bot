"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var web3_js_1 = require("@solana/web3.js");
var PythConnection_1 = require("./PythConnection");
var _1 = require(".");
var PYTHNET_CLUSTER_NAME = 'pythnet';
var connection = new web3_js_1.Connection(_1.getPythClusterApiUrl(PYTHNET_CLUSTER_NAME));
var pythPublicKey = _1.getPythProgramKeyForCluster(PYTHNET_CLUSTER_NAME);
// This feed ID comes from this list: https://pyth.network/developers/price-feed-ids#solana-mainnet-beta
// This example shows Crypto.SOL/USD
var feeds = [new web3_js_1.PublicKey('H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG')];
var pythConnection = new PythConnection_1.PythConnection(connection, pythPublicKey, 'confirmed', feeds);
pythConnection.onPriceChangeVerbose(function (productAccount, priceAccount) {
    // The arguments to the callback include solana account information / the update slot if you need it.
    var product = productAccount.accountInfo.data.product;
    var price = priceAccount.accountInfo.data;
    // sample output:
    // SOL/USD: $14.627930000000001 ±$0.01551797
    if (price.price && price.confidence) {
        // tslint:disable-next-line:no-console
        console.log(product.symbol + ": $" + price.price + " \u00B1$" + price.confidence);
    }
    else {
        // tslint:disable-next-line:no-console
        console.log(product.symbol + ": price currently unavailable. status is " + _1.PriceStatus[price.status]);
    }
});
// tslint:disable-next-line:no-console
console.log('Reading from Pyth price feed...');
pythConnection.start();
