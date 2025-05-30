/// <reference types="node" />
import { TypesCoder } from '@coral-xyz/anchor';
export declare class PythOracleTypesCoder implements TypesCoder {
    encode<T = any>(_name: string, _type: T): Buffer;
    decode<T = any>(_name: string, _typeData: Buffer): T;
}
