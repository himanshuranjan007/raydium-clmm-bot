"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythOracleCoder = void 0;
var events_1 = require("./events");
var accounts_1 = require("./accounts");
var instructions_1 = require("./instructions");
var state_1 = require("./state");
var types_1 = require("./types");
/**
 * Coder for PythOracleCoder
 */
var PythOracleCoder = /** @class */ (function () {
    function PythOracleCoder(idl) {
        this.accounts = new accounts_1.PythOracleAccountCoder(idl);
        this.events = new events_1.PythOracleEventCoder();
        this.instruction = new instructions_1.PythOracleInstructionCoder(idl);
        this.state = new state_1.PythOracleStateCoder();
        this.types = new types_1.PythOracleTypesCoder();
    }
    return PythOracleCoder;
}());
exports.PythOracleCoder = PythOracleCoder;
