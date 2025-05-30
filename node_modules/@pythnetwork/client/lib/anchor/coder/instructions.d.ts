/// <reference types="node" />
import { PublicKey } from '@solana/web3.js';
import { Idl, IdlField, IdlType, IdlAccountItem } from '@coral-xyz/anchor/dist/cjs/idl';
import { InstructionCoder } from '@coral-xyz/anchor';
export declare type PythIdlInstruction = {
    name: string;
    docs?: string[];
    accounts: IdlAccountItem[];
    args: IdlField[];
    returns?: IdlType;
    discriminant: IdlDiscriminant;
};
export declare type IdlDiscriminant = {
    value: number[];
};
/**
 * Encodes and decodes program instructions.
 */
export declare class PythOracleInstructionCoder implements InstructionCoder {
    private idl;
    private ixLayout;
    private discriminatorLayouts;
    private ixDiscriminator;
    private discriminatorLength;
    constructor(idl: Idl);
    /**
     * Encodes a program state instruction.
     */
    encodeState(ixName: string, ix: any): Buffer;
    /**
     * Encodes a program instruction.
     */
    encode(ixName: string, ix: any): Buffer;
    private static parseIxLayout;
    /**
     * Decodes a program instruction.
     */
    decode(ix: Buffer | string, encoding?: 'hex' | 'base58'): Instruction | null;
}
export declare type Instruction = {
    name: string;
    data: any;
};
export declare type InstructionDisplay = {
    args: {
        name: string;
        type: string;
        data: string;
    }[];
    accounts: {
        name?: string;
        pubkey: PublicKey;
        isSigner: boolean;
        isWritable: boolean;
    }[];
};
