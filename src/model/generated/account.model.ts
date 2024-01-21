import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToMany as OneToMany_} from "typeorm"
import {Transfer} from "./transfer.model"

@Entity_()
export class Account {
    constructor(props?: Partial<Account>) {
        Object.assign(this, props)
    }

    /**
     * Account address
     */
    @PrimaryColumn_()
    id!: string

    /**
     * Account transfers in
     */
    @OneToMany_(() => Transfer, e => e.to)
    transfersTo!: Transfer[]

    /**
     * Account transfers out
     */
    @OneToMany_(() => Transfer, e => e.from)
    transfersFrom!: Transfer[]
}
