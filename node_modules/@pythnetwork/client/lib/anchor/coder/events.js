"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythOracleEventCoder = void 0;
var PythOracleEventCoder = /** @class */ (function () {
    function PythOracleEventCoder() {
    }
    PythOracleEventCoder.prototype.decode = function (_log) {
        throw new Error('Pyth oracle program does not have events');
    };
    return PythOracleEventCoder;
}());
exports.PythOracleEventCoder = PythOracleEventCoder;
