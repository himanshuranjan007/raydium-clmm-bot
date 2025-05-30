/// <reference types="node" />
import { StateCoder } from '@coral-xyz/anchor';
export declare class PythOracleStateCoder implements StateCoder {
    encode<T = any>(_name: string, _account: T): Promise<Buffer>;
    decode<T = any>(_ix: Buffer): T;
}
