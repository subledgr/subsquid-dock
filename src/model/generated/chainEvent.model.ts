import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_} from "typeorm"

@Entity_()
export class ChainEvent {
    constructor(props?: Partial<ChainEvent>) {
        Object.assign(this, props)
    }

    /**
     * Event id (blockNumber-index)
     */
    @PrimaryColumn_()
    id!: string

    /**
     * Event block
     */
    @Index_()
    @Column_("int4", {nullable: false})
    blockNumber!: number

    /**
     * Event index in block
     */
    @Index_()
    @Column_("int4", {nullable: false})
    index!: number

    /**
     * Event extrinsicId
     */
    @Index_()
    @Column_("text", {nullable: false})
    extrinsicId!: string

    /**
     * Event section
     */
    @Index_()
    @Column_("text", {nullable: false})
    section!: string

    /**
     * Event method
     */
    @Index_()
    @Column_("text", {nullable: false})
    method!: string

    /**
     * Event data
     */
    @Index_()
    @Column_("text", {nullable: false})
    data!: string

    /**
     * Event timestamp
     */
    @Index_()
    @Column_("timestamp with time zone", {nullable: false})
    timestamp!: Date
}
