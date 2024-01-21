import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_} from "typeorm"

@Entity_()
export class Block {
    constructor(props?: Partial<Block>) {
        Object.assign(this, props)
    }

    /**
     * Block number
     */
    @PrimaryColumn_()
    id!: string

    /**
     * Block hash
     */
    @Index_()
    @Column_("text", {nullable: false})
    hash!: string

    /**
     * Block timestamp
     */
    @Index_()
    @Column_("timestamp with time zone", {nullable: false})
    timestamp!: Date
}
