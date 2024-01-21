import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"

@Entity_()
export class Extrinsic {
    constructor(props?: Partial<Extrinsic>) {
        Object.assign(this, props)
    }

    /**
     * Extrinsic id (blockNumber-index)
     */
    @PrimaryColumn_()
    id!: string

    /**
     * Extrinsic block
     */
    @Index_()
    @Column_("int4", {nullable: false})
    blockNumber!: number

    /**
     * Extrinsic index in block
     */
    @Index_()
    @Column_("int4", {nullable: false})
    index!: number

    /**
     * Extrinsic hash
     */
    @Index_()
    @Column_("text", {nullable: false})
    hash!: string

    /**
     * Extrinsic timestamp
     */
    @Index_()
    @Column_("timestamp with time zone", {nullable: false})
    timestamp!: Date

    /**
     * Extrinsic signer
     */
    @Index_()
    @Column_("text", {nullable: false})
    signer!: string

    /**
     * Extrinsic section
     */
    @Index_()
    @Column_("text", {nullable: false})
    section!: string

    /**
     * Extrinsic method
     */
    @Index_()
    @Column_("text", {nullable: false})
    method!: string

    /**
     * Extrinsic fee
     */
    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    fee!: bigint

    /**
     * Extrinsic success
     */
    @Index_()
    @Column_("bool", {nullable: true})
    success!: boolean | undefined | null
}
