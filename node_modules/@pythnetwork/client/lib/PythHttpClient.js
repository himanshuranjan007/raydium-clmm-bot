"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythHttpClient = void 0;
var _1 = require(".");
/**
 * Reads Pyth price data from a solana web3 connection. This class uses a single HTTP call.
 * Use the method getData() to get updated prices values.
 */
var PythHttpClient = /** @class */ (function () {
    function PythHttpClient(connection, pythProgramKey, commitment) {
        if (commitment === void 0) { commitment = 'finalized'; }
        this.connection = connection;
        this.pythProgramKey = pythProgramKey;
        this.commitment = commitment;
    }
    /*
     * Get Pyth Network account information and return actual price state.
     * The result contains lists of asset types, product symbols and their prices.
     */
    PythHttpClient.prototype.getData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var assetTypes, productSymbols, products, productFromSymbol, productPrice, prices, _a, accountList, currentSlot, priceDataQueue, productAccountKeyToProduct, permissionData, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        assetTypes = new Set();
                        productSymbols = new Set();
                        products = new Set();
                        productFromSymbol = new Map();
                        productPrice = new Map();
                        prices = new Array();
                        return [4 /*yield*/, Promise.all([
                                this.connection.getProgramAccounts(this.pythProgramKey, this.commitment),
                                this.connection.getSlot(this.commitment),
                            ])
                            // Populate products and prices
                        ];
                    case 1:
                        _a = _b.sent(), accountList = _a[0], currentSlot = _a[1];
                        priceDataQueue = new Array();
                        productAccountKeyToProduct = new Map();
                        accountList.forEach(function (singleAccount) {
                            var base = _1.parseBaseData(singleAccount.account.data);
                            if (base) {
                                switch (base.type) {
                                    case _1.AccountType.Mapping:
                                        // We can skip these because we're going to get every account owned by this program anyway.
                                        break;
                                    case _1.AccountType.Product:
                                        var productData = _1.parseProductData(singleAccount.account.data);
                                        productAccountKeyToProduct.set(singleAccount.pubkey.toBase58(), productData.product);
                                        assetTypes.add(productData.product.asset_type);
                                        productSymbols.add(productData.product.symbol);
                                        products.add(productData.product);
                                        productFromSymbol.set(productData.product.symbol, productData.product);
                                        break;
                                    case _1.AccountType.Price:
                                        var priceData = _1.parsePriceData(singleAccount.account.data, currentSlot);
                                        priceDataQueue.push(priceData);
                                        break;
                                    case _1.AccountType.Test:
                                        break;
                                    case _1.AccountType.Permission:
                                        permissionData = _1.parsePermissionData(singleAccount.account.data);
                                        break;
                                    default:
                                        throw new Error("Unknown account type: " + base.type + ". Try upgrading pyth-client.");
                                }
                            }
                        });
                        priceDataQueue.forEach(function (priceData) {
                            var product = productAccountKeyToProduct.get(priceData.productAccountKey.toBase58());
                            if (product) {
                                productPrice.set(product.symbol, priceData);
                                prices.push(priceData);
                            }
                        });
                        result = {
                            assetTypes: Array.from(assetTypes),
                            symbols: Array.from(productSymbols),
                            products: Array.from(products),
                            productFromSymbol: productFromSymbol,
                            productPrice: productPrice,
                            prices: prices,
                            permissionData: permissionData,
                        };
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Get the price state for an array of specified price accounts.
     * The result is the price state for the given assets if they exist, throws if at least one account does not exist.
     */
    PythHttpClient.prototype.getAssetPricesFromAccounts = function (priceAccounts) {
        return __awaiter(this, void 0, void 0, function () {
            var priceDatas, _a, accountInfos, currentSlot, i, accInfo, baseData, priceData;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        priceDatas = [];
                        return [4 /*yield*/, Promise.all([
                                this.connection.getMultipleAccountsInfo(priceAccounts, this.commitment),
                                this.connection.getSlot(this.commitment),
                            ])];
                    case 1:
                        _a = _b.sent(), accountInfos = _a[0], currentSlot = _a[1];
                        for (i = 0; i < priceAccounts.length; i++) {
                            accInfo = accountInfos[i];
                            if (!accInfo) {
                                throw new Error('Could not get account info for account ' + priceAccounts[i].toBase58());
                            }
                            baseData = _1.parseBaseData(accInfo.data);
                            if (baseData === undefined || baseData.type !== _1.AccountType.Price) {
                                throw new Error('Account ' + priceAccounts[i].toBase58() + ' is not a price account');
                            }
                            priceData = _1.parsePriceData(accInfo.data, currentSlot);
                            priceDatas.push(priceData);
                        }
                        return [2 /*return*/, priceDatas];
                }
            });
        });
    };
    return PythHttpClient;
}());
exports.PythHttpClient = PythHttpClient;
