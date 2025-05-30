/// <reference types="node" />
import { AccountsCoder, Idl } from '@coral-xyz/anchor';
import { IdlTypeDef } from '@coral-xyz/anchor/dist/cjs/idl';
export declare class PythOracleAccountCoder<A extends string = string> implements AccountsCoder {
    private idl;
    constructor(idl: Idl);
    encode<T = any>(accountName: A, account: T): Promise<Buffer>;
    decode<T = any>(accountName: A, ix: Buffer): T;
    decodeUnchecked<T = any>(accountName: A, ix: Buffer): T;
    memcmp(accountName: A, _appendData?: Buffer): {
        dataSize?: number;
        offset?: number;
        bytes?: string;
    };
    size(idlAccount: IdlTypeDef): number;
}
