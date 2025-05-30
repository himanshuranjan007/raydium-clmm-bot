"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPythProgramKeyForCluster = exports.getPythClusterApiUrl = exports.pythOracleProgram = exports.pythOracleCoder = exports.pythIdl = exports.PythHttpClient = exports.PythConnection = exports.parsePermissionData = exports.parsePriceData = exports.parseProductData = exports.parseMappingData = exports.parseBaseData = exports.AccountType = exports.DeriveType = exports.PriceType = exports.CorpAction = exports.PriceStatus = exports.MAX_SLOT_DIFFERENCE = exports.Version = exports.Version2 = exports.Magic = void 0;
var web3_js_1 = require("@solana/web3.js");
var buffer_1 = require("buffer");
var readBig_1 = require("./readBig");
/** Constants. This section must be kept in sync with the on-chain program. */
exports.Magic = 0xa1b2c3d4;
exports.Version2 = 2;
exports.Version = exports.Version2;
/** Number of slots that can pass before a publisher's price is no longer included in the aggregate. */
exports.MAX_SLOT_DIFFERENCE = 25;
var PriceStatus;
(function (PriceStatus) {
    PriceStatus[PriceStatus["Unknown"] = 0] = "Unknown";
    PriceStatus[PriceStatus["Trading"] = 1] = "Trading";
    PriceStatus[PriceStatus["Halted"] = 2] = "Halted";
    PriceStatus[PriceStatus["Auction"] = 3] = "Auction";
    PriceStatus[PriceStatus["Ignored"] = 4] = "Ignored";
})(PriceStatus = exports.PriceStatus || (exports.PriceStatus = {}));
var CorpAction;
(function (CorpAction) {
    CorpAction[CorpAction["NoCorpAct"] = 0] = "NoCorpAct";
})(CorpAction = exports.CorpAction || (exports.CorpAction = {}));
var PriceType;
(function (PriceType) {
    PriceType[PriceType["Unknown"] = 0] = "Unknown";
    PriceType[PriceType["Price"] = 1] = "Price";
})(PriceType = exports.PriceType || (exports.PriceType = {}));
var DeriveType;
(function (DeriveType) {
    DeriveType[DeriveType["Unknown"] = 0] = "Unknown";
    DeriveType[DeriveType["Volatility"] = 1] = "Volatility";
})(DeriveType = exports.DeriveType || (exports.DeriveType = {}));
var AccountType;
(function (AccountType) {
    AccountType[AccountType["Unknown"] = 0] = "Unknown";
    AccountType[AccountType["Mapping"] = 1] = "Mapping";
    AccountType[AccountType["Product"] = 2] = "Product";
    AccountType[AccountType["Price"] = 3] = "Price";
    AccountType[AccountType["Test"] = 4] = "Test";
    AccountType[AccountType["Permission"] = 5] = "Permission";
})(AccountType = exports.AccountType || (exports.AccountType = {}));
var empty32Buffer = buffer_1.Buffer.alloc(32);
var PKorNull = function (data) { return (data.equals(empty32Buffer) ? null : new web3_js_1.PublicKey(data)); };
/** Parse data as a generic Pyth account. Use this method if you don't know the account type. */
function parseBaseData(data) {
    // data is too short to have the magic number.
    if (data.byteLength < 4) {
        return undefined;
    }
    var magic = data.readUInt32LE(0);
    if (magic === exports.Magic) {
        // program version
        var version = data.readUInt32LE(4);
        // account type
        var type = data.readUInt32LE(8);
        // account used size
        var size = data.readUInt32LE(12);
        return { magic: magic, version: version, type: type, size: size };
    }
    else {
        return undefined;
    }
}
exports.parseBaseData = parseBaseData;
var parseMappingData = function (data) {
    // pyth magic number
    var magic = data.readUInt32LE(0);
    // program version
    var version = data.readUInt32LE(4);
    // account type
    var type = data.readUInt32LE(8);
    // account used size
    var size = data.readUInt32LE(12);
    // number of product accounts
    var numProducts = data.readUInt32LE(16);
    // unused
    // const unused = accountInfo.data.readUInt32LE(20)
    // next mapping account (if any)
    var nextMappingAccount = PKorNull(data.slice(24, 56));
    // read each symbol account
    var offset = 56;
    var productAccountKeys = [];
    for (var i = 0; i < numProducts; i++) {
        var productAccountBytes = data.slice(offset, offset + 32);
        var productAccountKey = new web3_js_1.PublicKey(productAccountBytes);
        offset += 32;
        productAccountKeys.push(productAccountKey);
    }
    return {
        magic: magic,
        version: version,
        type: type,
        size: size,
        nextMappingAccount: nextMappingAccount,
        productAccountKeys: productAccountKeys,
    };
};
exports.parseMappingData = parseMappingData;
var parseProductData = function (data) {
    // pyth magic number
    var magic = data.readUInt32LE(0);
    // program version
    var version = data.readUInt32LE(4);
    // account type
    var type = data.readUInt32LE(8);
    // price account size
    var size = data.readUInt32LE(12);
    // first price account in list
    var priceAccountBytes = data.slice(16, 48);
    var priceAccountKey = PKorNull(priceAccountBytes);
    var product = {};
    if (priceAccountKey)
        product.price_account = priceAccountKey.toBase58();
    var idx = 48;
    while (idx < size) {
        var keyLength = data[idx];
        idx++;
        if (keyLength) {
            var key = data.slice(idx, idx + keyLength).toString();
            idx += keyLength;
            var valueLength = data[idx];
            idx++;
            var value = data.slice(idx, idx + valueLength).toString();
            idx += valueLength;
            product[key] = value;
        }
    }
    return { magic: magic, version: version, type: type, size: size, priceAccountKey: priceAccountKey, product: product };
};
exports.parseProductData = parseProductData;
var parseEma = function (data, exponent) {
    // current value of ema
    var valueComponent = readBig_1.readBigInt64LE(data, 0);
    var value = Number(valueComponent) * Math.pow(10, exponent);
    // numerator state for next update
    var numerator = readBig_1.readBigInt64LE(data, 8);
    // denominator state for next update
    var denominator = readBig_1.readBigInt64LE(data, 16);
    return { valueComponent: valueComponent, value: value, numerator: numerator, denominator: denominator };
};
var parsePriceInfo = function (data, exponent) {
    // aggregate price
    var priceComponent = readBig_1.readBigInt64LE(data, 0);
    var price = Number(priceComponent) * Math.pow(10, exponent);
    // aggregate confidence
    var confidenceComponent = readBig_1.readBigUInt64LE(data, 8);
    var confidence = Number(confidenceComponent) * Math.pow(10, exponent);
    // aggregate status
    var status = data.readUInt32LE(16);
    // aggregate corporate action
    var corporateAction = data.readUInt32LE(20);
    // aggregate publish slot. It is converted to number to be consistent with Solana's library interface (Slot there is number)
    var publishSlot = Number(readBig_1.readBigUInt64LE(data, 24));
    return {
        priceComponent: priceComponent,
        price: price,
        confidenceComponent: confidenceComponent,
        confidence: confidence,
        status: status,
        corporateAction: corporateAction,
        publishSlot: publishSlot,
    };
};
// Provide currentSlot when available to allow status to consider the case when price goes stale. It is optional because
// it requires an extra request to get it when it is not available which is not always efficient.
var parsePriceData = function (data, currentSlot) {
    // pyth magic number
    var magic = data.readUInt32LE(0);
    // program version
    var version = data.readUInt32LE(4);
    // account type
    var type = data.readUInt32LE(8);
    // price account size
    var size = data.readUInt32LE(12);
    // price or calculation type
    var priceType = data.readUInt32LE(16);
    // price exponent
    var exponent = data.readInt32LE(20);
    // number of component prices
    var numComponentPrices = data.readUInt32LE(24);
    // number of quoters that make up aggregate
    var numQuoters = data.readUInt32LE(28);
    // slot of last valid (not unknown) aggregate price
    var lastSlot = readBig_1.readBigUInt64LE(data, 32);
    // valid on-chain slot of aggregate price
    var validSlot = readBig_1.readBigUInt64LE(data, 40);
    // exponential moving average price
    var emaPrice = parseEma(data.slice(48, 72), exponent);
    // exponential moving average confidence interval
    var emaConfidence = parseEma(data.slice(72, 96), exponent);
    // timestamp of the current price
    var timestamp = readBig_1.readBigInt64LE(data, 96);
    // minimum number of publishers for status to be TRADING
    var minPublishers = data.readUInt8(104);
    // message sent flag
    var messageSent = data.readUInt8(105);
    // configurable max latency in slots between send and receive
    var maxLatency = data.readUInt8(106);
    // Various flags (used for operations)
    var flagBits = data.readInt8(107);
    /* tslint:disable:no-bitwise */
    var flags = {
        accumulatorV2: (flagBits & (1 << 0)) !== 0,
        messageBufferCleared: (flagBits & (1 << 1)) !== 0,
    };
    /* tslint:enable:no-bitwise */
    // Globally immutable unique price feed index used for publishing.
    var feedIndex = data.readInt32LE(108);
    // product id / reference account
    var productAccountKey = new web3_js_1.PublicKey(data.slice(112, 144));
    // next price account in list
    var nextPriceAccountKey = PKorNull(data.slice(144, 176));
    // valid slot of previous update
    var previousSlot = readBig_1.readBigUInt64LE(data, 176);
    // aggregate price of previous update
    var previousPriceComponent = readBig_1.readBigInt64LE(data, 184);
    var previousPrice = Number(previousPriceComponent) * Math.pow(10, exponent);
    // confidence interval of previous update
    var previousConfidenceComponent = readBig_1.readBigUInt64LE(data, 192);
    var previousConfidence = Number(previousConfidenceComponent) * Math.pow(10, exponent);
    // space for future derived values
    var previousTimestamp = readBig_1.readBigInt64LE(data, 200);
    var aggregate = parsePriceInfo(data.slice(208, 240), exponent);
    var status = aggregate.status;
    if (currentSlot && status === PriceStatus.Trading) {
        if (currentSlot - aggregate.publishSlot > exports.MAX_SLOT_DIFFERENCE) {
            status = PriceStatus.Unknown;
        }
    }
    var price;
    var confidence;
    if (status === PriceStatus.Trading) {
        price = aggregate.price;
        confidence = aggregate.confidence;
    }
    // price components - up to 32
    var priceComponents = [];
    var offset = 240;
    while (priceComponents.length < numComponentPrices) {
        var publisher = new web3_js_1.PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        var componentAggregate = parsePriceInfo(data.slice(offset, offset + 32), exponent);
        offset += 32;
        var latest = parsePriceInfo(data.slice(offset, offset + 32), exponent);
        offset += 32;
        priceComponents.push({ publisher: publisher, aggregate: componentAggregate, latest: latest });
    }
    return {
        magic: magic,
        version: version,
        type: type,
        size: size,
        priceType: priceType,
        exponent: exponent,
        numComponentPrices: numComponentPrices,
        numQuoters: numQuoters,
        lastSlot: lastSlot,
        validSlot: validSlot,
        emaPrice: emaPrice,
        emaConfidence: emaConfidence,
        timestamp: timestamp,
        minPublishers: minPublishers,
        messageSent: messageSent,
        maxLatency: maxLatency,
        flags: flags,
        feedIndex: feedIndex,
        productAccountKey: productAccountKey,
        nextPriceAccountKey: nextPriceAccountKey,
        previousSlot: previousSlot,
        previousPriceComponent: previousPriceComponent,
        previousPrice: previousPrice,
        previousConfidenceComponent: previousConfidenceComponent,
        previousConfidence: previousConfidence,
        previousTimestamp: previousTimestamp,
        aggregate: aggregate,
        priceComponents: priceComponents,
        price: price,
        confidence: confidence,
        status: status,
    };
};
exports.parsePriceData = parsePriceData;
var parsePermissionData = function (data) {
    // pyth magic number
    var magic = data.readUInt32LE(0);
    // program version
    var version = data.readUInt32LE(4);
    // account type
    var type = data.readUInt32LE(8);
    // price account size
    var size = data.readUInt32LE(12);
    var masterAuthority = new web3_js_1.PublicKey(data.slice(16, 48));
    var dataCurationAuthority = new web3_js_1.PublicKey(data.slice(48, 80));
    var securityAuthority = new web3_js_1.PublicKey(data.slice(80, 112));
    return {
        magic: magic,
        version: version,
        type: type,
        size: size,
        masterAuthority: masterAuthority,
        dataCurationAuthority: dataCurationAuthority,
        securityAuthority: securityAuthority,
    };
};
exports.parsePermissionData = parsePermissionData;
var PythConnection_1 = require("./PythConnection");
Object.defineProperty(exports, "PythConnection", { enumerable: true, get: function () { return PythConnection_1.PythConnection; } });
var PythHttpClient_1 = require("./PythHttpClient");
Object.defineProperty(exports, "PythHttpClient", { enumerable: true, get: function () { return PythHttpClient_1.PythHttpClient; } });
var anchor_1 = require("./anchor");
Object.defineProperty(exports, "pythIdl", { enumerable: true, get: function () { return anchor_1.pythIdl; } });
Object.defineProperty(exports, "pythOracleCoder", { enumerable: true, get: function () { return anchor_1.pythOracleCoder; } });
Object.defineProperty(exports, "pythOracleProgram", { enumerable: true, get: function () { return anchor_1.pythOracleProgram; } });
var cluster_1 = require("./cluster");
Object.defineProperty(exports, "getPythClusterApiUrl", { enumerable: true, get: function () { return cluster_1.getPythClusterApiUrl; } });
Object.defineProperty(exports, "getPythProgramKeyForCluster", { enumerable: true, get: function () { return cluster_1.getPythProgramKeyForCluster; } });
