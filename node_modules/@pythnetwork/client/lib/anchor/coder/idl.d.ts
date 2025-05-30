import { Layout } from 'buffer-layout';
import { IdlField, IdlTypeDef } from '@coral-xyz/anchor/dist/cjs/idl';
export declare class IdlCoder {
    static fieldLayout(field: {
        name?: string;
    } & Pick<IdlField, 'type'>, types?: IdlTypeDef[]): Layout;
    static typeDefLayout(typeDef: IdlTypeDef, types?: IdlTypeDef[], name?: string): Layout;
}
