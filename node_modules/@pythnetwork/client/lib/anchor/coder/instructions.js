"use strict";
// Borrowed from coral-xyz/anchor
//
// https://github.com/coral-xyz/anchor/blob/master/ts/packages/anchor/src/coder/borsh/instruction.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythOracleInstructionCoder = void 0;
var bs58_1 = __importDefault(require("bs58"));
var buffer_1 = require("buffer");
var camelcase_1 = __importDefault(require("camelcase"));
var borsh = __importStar(require("@coral-xyz/borsh"));
var idl_1 = require("./idl");
var MAX_METADATA_SIZE = 464;
/**
 * Encodes and decodes program instructions.
 */
var PythOracleInstructionCoder = /** @class */ (function () {
    function PythOracleInstructionCoder(idl) {
        var _this = this;
        this.idl = idl;
        this.ixLayout = PythOracleInstructionCoder.parseIxLayout(idl);
        var discriminatorLayouts = new Map();
        var ixDiscriminator = new Map();
        idl.instructions.forEach(function (ix) {
            var pythIx = ix;
            var discriminatorLength;
            if (pythIx.discriminant) {
                discriminatorLayouts.set(bs58_1.default.encode(buffer_1.Buffer.from(pythIx.discriminant.value)), {
                    layout: _this.ixLayout.get(pythIx.name),
                    name: pythIx.name,
                });
                ixDiscriminator.set(pythIx.name, buffer_1.Buffer.from(pythIx.discriminant.value));
                discriminatorLength = pythIx.discriminant.value.length;
            }
            else {
                throw new Error("All instructions must have a discriminator");
            }
            if (_this.discriminatorLength && _this.discriminatorLength !== discriminatorLength) {
                throw new Error("All instructions must have the same discriminator length");
            }
            else {
                _this.discriminatorLength = discriminatorLength;
            }
        });
        this.discriminatorLayouts = discriminatorLayouts;
        this.ixDiscriminator = ixDiscriminator;
    }
    /**
     * Encodes a program state instruction.
     */
    PythOracleInstructionCoder.prototype.encodeState = function (ixName, ix) {
        return this.encode(ixName, ix);
    };
    /**
     * Encodes a program instruction.
     */
    PythOracleInstructionCoder.prototype.encode = function (ixName, ix) {
        var buffer = buffer_1.Buffer.alloc(1000); // TODO: use a tighter buffer.
        var methodName = camelcase_1.default(ixName);
        var layout = this.ixLayout.get(methodName);
        var discriminator = this.ixDiscriminator.get(methodName);
        if (!layout || !discriminator) {
            throw new Error("Unknown method: " + methodName);
        }
        /// updProduct and addProduct have their own format
        if (methodName === 'updProduct' || methodName === 'addProduct') {
            var offset = 0;
            for (var _i = 0, _a = Object.keys(ix.productMetadata); _i < _a.length; _i++) {
                var key = _a[_i];
                offset += buffer.subarray(offset).writeUInt8(buffer_1.Buffer.byteLength(key));
                offset += buffer.subarray(offset).write(key);
                offset += buffer.subarray(offset).writeUInt8(buffer_1.Buffer.byteLength(ix.productMetadata[key]));
                offset += buffer.subarray(offset).write(ix.productMetadata[key]);
            }
            if (offset > MAX_METADATA_SIZE) {
                throw new Error('The metadata is too long');
            }
            var data = buffer.subarray(0, offset);
            return buffer_1.Buffer.concat([discriminator, data]);
        }
        else {
            var len = layout.encode(ix, buffer);
            var data = buffer.subarray(0, len);
            return buffer_1.Buffer.concat([discriminator, data]);
        }
    };
    PythOracleInstructionCoder.parseIxLayout = function (idl) {
        var ixLayouts = idl.instructions.map(function (ix) {
            var fieldLayouts = ix.args.map(function (arg) { var _a, _b; return idl_1.IdlCoder.fieldLayout(arg, Array.from(__spreadArray(__spreadArray([], ((_a = idl.accounts) !== null && _a !== void 0 ? _a : [])), ((_b = idl.types) !== null && _b !== void 0 ? _b : [])))); });
            var name = camelcase_1.default(ix.name);
            return [name, borsh.struct(fieldLayouts, name)];
        });
        return new Map(ixLayouts);
    };
    /**
     * Decodes a program instruction.
     */
    PythOracleInstructionCoder.prototype.decode = function (ix, encoding) {
        if (encoding === void 0) { encoding = 'hex'; }
        if (typeof ix === 'string') {
            ix = encoding === 'hex' ? buffer_1.Buffer.from(ix, 'hex') : buffer_1.Buffer.from(bs58_1.default.decode(ix));
        }
        var discriminator = bs58_1.default.encode(ix.subarray(0, this.discriminatorLength));
        var data = ix.subarray(this.discriminatorLength);
        var decoder = this.discriminatorLayouts.get(discriminator);
        if (!decoder) {
            return null;
        }
        /// updProduct and addProduct have their own format
        if (decoder.name === 'updProduct' || decoder.name === 'addProduct') {
            var product = {};
            var idx = 0;
            while (idx < data.length) {
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
            return {
                data: product,
                name: decoder.name,
            };
        }
        else {
            return {
                data: decoder.layout.decode(data),
                name: decoder.name,
            };
        }
    };
    return PythOracleInstructionCoder;
}());
exports.PythOracleInstructionCoder = PythOracleInstructionCoder;
