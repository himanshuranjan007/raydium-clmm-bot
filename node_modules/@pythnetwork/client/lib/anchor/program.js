"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pythIdl = exports.pythOracleCoder = exports.pythOracleProgram = void 0;
var anchor_1 = require("@coral-xyz/anchor");
var coder_1 = require("./coder");
var idl_json_1 = __importDefault(require("./idl.json"));
/** The Pyth program is not fully compatible with Anchor idls.
 * However it can be interacted with from Anchor clients by using PythOracleCoder from this library.
 * It currently only supports instructions. To deserialize accounts one can use the non-Anchor
 * parsing functions from this package.
 */
function pythOracleProgram(programId, provider) {
    return new anchor_1.Program(idl_json_1.default, programId, provider, new coder_1.PythOracleCoder(idl_json_1.default));
}
exports.pythOracleProgram = pythOracleProgram;
function pythOracleCoder() {
    return new coder_1.PythOracleCoder(idl_json_1.default);
}
exports.pythOracleCoder = pythOracleCoder;
var idl_json_2 = require("./idl.json");
Object.defineProperty(exports, "pythIdl", { enumerable: true, get: function () { return __importDefault(idl_json_2).default; } });
