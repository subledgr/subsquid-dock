import { TypeormDatabase, Store } from '@subsquid/typeorm-store'
import { In } from 'typeorm'
import * as ss58 from '@subsquid/ss58'
import assert from 'assert'

import { processor, ProcessorContext } from './processor'
import { Account, Transfer } from './model'
import { events } from './types'
import { assertNotNull } from '@subsquid/substrate-processor'

const CHAIN_ID = assertNotNull(process.env.CHAIN_ID, 'CHAIN_ID env var is not set')

processor.run(new TypeormDatabase({ supportHotBlocks: false }), async (ctx) => {
  let transferEvents: TransferEvent[] = getTransferEvents(ctx)

  let accounts: Map<string, Account> = await createAccounts(ctx, transferEvents)
  let transfers: Transfer[] = createTransfers(transferEvents, accounts)
  // console.debug(`Saving ${accounts.size} accounts and ${transfers.length} transfers`)

  await ctx.store.upsert([...accounts.values()])
  await ctx.store.insert(transfers)

  // store chain data
  // let { blocks, extrinsics, events } = await getChainData(ctx)
  // await ctx.store.insert(blocks)
  // await ctx.store.insert(extrinsics)
  // await ctx.store.insert(events)
})

export interface Block {
  id: string
  blockNumber: number
  timestamp: Date
}

export interface Extrinsic {
  id: string
  hash: string
  caller?: string
  section?: string
  method?: string
  fee: bigint
  success: boolean
}

/**
 * ChainEvent is a generic event that is stored in the `event` table.
 */
export interface ChainEvent {
  id: string
  chainId: string
  blockNumber: number
  timestamp: Date
  extrinsicId?: string
  extrinsicHash?: string
  section?: string
  method?: string
  args?: string
}

// sync with the TransferEvent definition in ../schema.graphql
/**
 * TransferEvent is an event that changes an account balance, stored in the `transfer` table.
 * \
 * TODO: check for duplicates between Balances.Withdraw and TransactionPayment.TransactionFeePaid
 */
export interface TransferEvent {
  id: string
  chainId: string
  blockNumber: number
  timestamp: Date
  extrinsicId?: string
  extrinsicHash?: string
  section?: string
  method?: string
  from: string
  to: string
  amount: bigint
  fee?: bigint
}

async function getChainData(ctx: ProcessorContext<Store>): Promise<{blocks: Block[], extrinsics: Extrinsic[], events: ChainEvent[]}> {
  let blocks: Block[] = []
  let extrinsics: Extrinsic[] = []
  let events: ChainEvent[] = []
  for (let block of ctx.blocks) {
    blocks.push({
      id: block.header.hash,
      blockNumber: block.header.height,
      timestamp: new Date(block.header.timestamp || ''),
    })
    for (let extrinsic of block.extrinsics) {
      let [section, method] = extrinsic.call?.name.split('.') || ['--', '--']
      extrinsics.push({
        id: extrinsic.id,
        hash: extrinsic.hash,
        caller: extrinsic.call?.address.toString(),
        section,
        method,
        fee: extrinsic.fee || 0n,
        success: extrinsic.success,
      })
    }
    for (let event of block.events) {
      let [section, method] = event.call?.name.split('.') || ['--', '--']
      events.push({
        id: event.id,
        chainId: CHAIN_ID,
        blockNumber: block.header.height,
        timestamp: new Date(block.header.timestamp || ''),
        section,
        method,
        args: event.args,
      })
    }

  }
  return { blocks, extrinsics, events }
}

function getTransferEvents(ctx: ProcessorContext<Store>): TransferEvent[] {
  // Filters and decodes the arriving events
  let blocks: Block[] = []
  let extrinsics: Extrinsic[] = []
  let transfers: TransferEvent[] = []
  // console.debug(`Processing ${ctx.blocks.length} blocks`)
  for (let block of ctx.blocks) {

    // // console.debug(`Processing block ${block.header.height}, extrinsics ${block.extrinsics.length}`)
    // for (let extrinsic of block.extrinsics) {

    //   if (!extrinsic.call?.origin) continue // no origin, no fee??
    //   // handle the fees paid by the caller
    //   // console.debug(extrinsic)
    //   let specVersion = block.header.specVersion
    //   // FIXME: should contain the fee in TransactionPayment.TransactionFeePaid
    //   // if (specVersion >= 9260) continue

    //   // calculate the fee for the extrinsic
    //   var totalFee: bigint | undefined = undefined // 0n
    //   var feeBalances: bigint | undefined  = undefined // 0n
    //   var feeTreasury: bigint | undefined  = undefined // 0n
    //   // console.debug(`Processing extrinsic ${extrinsic.id} at block ${block.header.height}, specVersion ${specVersion}`)
    //   switch (true) {
    //     case specVersion < 9120:
    //       extrinsic.events.forEach((e, idx) => {
    //         if (e.name == 'Balances.Deposit' && e.args[0] == block.header.validator) {
    //           // assume the validator fee includes the tip
    //           feeBalances = (feeBalances || 0n) + BigInt(e.args[1])
    //         }
    //         else if (e.name == 'Treasury.Deposit') {
    //           // console.debug(`Treasury.Deposit: .${e.args}.`)
    //           feeTreasury = (feeTreasury || 0n) + BigInt(e.args)
    //         }
    //       })
    //       totalFee = (feeBalances || 0n) + (feeTreasury || 0n)
    //       // console.debug(`totalFee: ${totalFee}, feeBalances: ${feeBalances}, feeTreasury: ${feeTreasury}`)
    //       break
    //     case specVersion >= 9120 && specVersion < 9260:
    //       const myBlock = extrinsic.call?.origin?.value?.value == block.header.validator; // a special condition
    //       totalFee = extrinsic.fee
    //       extrinsic.events.forEach((e, idx) => {
    //         if (
    //           e.name == 'Balances.Withdraw'
    //           && e.args[0] == extrinsic.call?.origin?.value?.value // from the sender's account
    //         ) {
    //           if (!totalFee) // first balances.Withdraw only
    //             totalFee = BigInt(e.args[1].toString());
    //         }
    //         // maybe there is a refund to the sender because the final fee is lower than the initial fee:
    //         else if (
    //           !myBlock
    //           && e.name == 'Balances.Deposit'
    //           // && e.args[0].toString() == extrinsic.call?.origin?.value?.value // into the sender's account
    //           && e.args[0] == extrinsic.call?.origin?.value?.value // into the sender's account
    //           && totalFee
    //         ) {
    //           const v = BigInt(e.args[1].toString());
    //           if (v <= totalFee)
    //             totalFee -= v;
    //         }
    //         // fee part going to Treasury:
    //         else if (e.name == 'Treasury.Deposit') {
    //           // console.debug(`Treasury.Deposit:`, e.args.value)
    //           feeTreasury = BigInt(e.args.value || 0);
    //         }
    //       })
    //       feeBalances = (totalFee || 0n) - (feeTreasury || 0n)
    //       // console.debug(`myBlock: ${myBlock}, totalFee: ${totalFee}, feeBalances: ${feeBalances}, feeTreasury: ${feeTreasury}`)
    //       break
    //     // not here, we'll check for transactionPayment::TransactionFeePaid in events
    //     // default:
    //     //   // check for event transactionPayment::TransactionFeePaid
    //     //   extrinsic.events.forEach((e, idx) => {
    //     //     // args = [address, fee, tip] // does the fee already include the tip?
    //     //     if (e.name == 'TransactionPayment.TransactionFeePaid') {
    //     //     }
    //     // })
    //   }

    //   // let [eSection, eMethod] = extrinsic.call?.name.split('.') || ['--', '--']
    //   // extrinsics.push({
    //   //   id: extrinsic.id,
    //   //   hash: extrinsic.hash,
    //   //   caller: extrinsic.call?.address.toString(),
    //   //   // section: extrinsic.section,
    //   //   // method: extrinsic.method,
    //   //   fee: extrinsic.fee || 0n,
    //   //   success: extrinsic.success,
    //   // })

    //   // // FIXME: find out what specVersion is applicable
    //   // // do we already have a balances.withdraw event for this fee amount?
    //   // const found = extrinsic.events.find((e) => {
    //   //   if (e.name != events.balances.withdraw.name) return false
    //   //   let rec = { who: '', amount: 0n }
    //   //   if(events.balances.withdraw.v9122.is(e)) {
    //   //     const [who, amount] = events.balances.withdraw.v9122.decode(e)
    //   //     rec = { who, amount }
    //   //   }
    //   //   else if(events.balances.withdraw.v9130.is(e)) {
    //   //     const {who, amount} = events.balances.withdraw.v9130.decode(e)
    //   //     rec = { who, amount }
    //   //   }
    //   //   return rec.who == extrinsic.call?.origin?.value?.value && rec.amount == totalFee
    //   // })
    //   // if (!found)
    //   if (totalFee && totalFee > 0n)
    //     transfers.push({
    //       // event id
    //       id: `${extrinsic.id}-fees`,
    //       chainId: CHAIN_ID,
    //       blockNumber: block.header.height,
    //       timestamp: new Date(block.header.timestamp || ''),
    //       extrinsicId: extrinsic.id,
    //       extrinsicHash: extrinsic.hash,
    //       section: 'Balances',
    //       method: 'Withdraw',
    //       // convert the address to ss58
    //       from: extrinsic.call?.origin?.value?.value ? ss58.codec('kusama').encode(extrinsic.call?.origin.value.value) : '',
    //       to: '',
    //       amount: totalFee || 0n,
    //       fee: extrinsic.fee || 0n,
    //     })
    // } // for (let extrinsic of block.extrinsics) {

    for (let event of block.events) {
      let saveToDb = true
      // some Endowed events have no data/params...
//      if (!event.args || !event.args[0]) continue

      let [section, method] = event.name.split('.')
      let rec: { from: string; to: string; amount: bigint } = { from: '', to: '', amount: 0n }
      console.debug(`Processing event ${event.name} at block ${block.header.height}`)

      // console.debug(`Processing event ${event.name} at block ${block.header.height}`)
      switch (event.name) {
        case events.transactionPayment.transactionFeePaid.name: // 'TransactionPayment.TransactionFeePaid':
          if (events.transactionPayment.transactionFeePaid.v9260.is(event)) {
            let {who, actualFee, tip} = events.transactionPayment.transactionFeePaid.v9260.decode(event)
            rec = { from: who, to: '', amount: actualFee }
          }
          else {
            throw new Error('Unsupported spec')
          }
          break
        case events.balances.balanceSet.name: // 'Balances.BalanceSet':
          if(events.balances.balanceSet.v1031.is(event)) {
            let [to, amount] = events.balances.balanceSet.v1031.decode(event)
            rec = { from: '', to, amount }
          }
          else if(events.balances.balanceSet.v9130.is(event)) {
            let {who, free, reserved} = events.balances.balanceSet.v9130.decode(event)
            rec = { from: '', to: who, amount: free }
          }
          else if(events.balances.balanceSet.v9420.is(event)) {
            let {who, free} = events.balances.balanceSet.v9420.decode(event)
            rec = { from: '', to: who, amount: free }
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;

        case events.balances.deposit.name: // 'Balances.Deposit':
          if(events.balances.deposit.v1032.is(event)) {
            let [to, amount] = events.balances.deposit.v1032.decode(event)
            rec = { from: '', to, amount }
          }
          else if(events.balances.deposit.v9130.is(event)) {
            let {who, amount} = events.balances.deposit.v9130.decode(event)
            rec = { from: '', to: who, amount }
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;
        
        case events.balances.endowed.name: // 'Balances.Endowed':
          if(events.balances.endowed.v1050.is(event)) {
            let [to, amount] = events.balances.endowed.v1050.decode(event)
            rec = { from: '', to, amount }
          }
          else if(events.balances.endowed.v9130.is(event)) {
            let { account, freeBalance } = events.balances.endowed.v9130.decode(event)
            rec = { from: '', to: account, amount: freeBalance }
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;

        case events.balances.newAccount.name: // 'Balances.NewAccount':
          if(events.balances.newAccount.v1020.is(event)) {
            let [to, amount] = events.balances.newAccount.v1020.decode(event)
            rec = { from: '', to, amount }
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;

        case events.balances.reapedAccount.name: // 'Balances.ReapedAccount':
          if(events.balances.reapedAccount.v1020.is(event)) {
            // FIXME: we don't seem to have the amount in this event
            // let [from] = events.balances.reapedAccount.v1020.decode(event)
            // rec = { from, to: '', amount: 0n }
            saveToDb = false
          }
          else if(events.balances.reapedAccount.v1031.is(event)) {
            let [from, amount] = events.balances.reapedAccount.v1031.decode(event)
            rec = { from, to: '', amount }
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;

        case events.balances.dustLost.name: // 'Balances.DustLost':
          if(events.balances.dustLost.v1050.is(event)) {
            let [from, amount] = events.balances.dustLost.v1050.decode(event)
            rec = { from, to: '', amount }
          }
          else if(events.balances.dustLost.v9130.is(event)) {
            let { account, amount } = events.balances.dustLost.v9130.decode(event)
            rec = { from: account, to: '', amount }
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;

        case 'Balances.Slashed':
          if(events.balances.slashed.v9122.is(event)) {
            let [from, amount] = events.balances.slashed.v9122.decode(event)
            rec = { from, to: '', amount }
          }
          else if(events.balances.slashed.v9130.is(event)) {
            let { who, amount } = events.balances.slashed.v9130.decode(event)
            rec = { from: who, to: '', amount }
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;

        case events.balances.withdraw.name: // 'Balances.Withdraw':
          if(events.balances.withdraw.v9122.is(event)) {
            let [ who, amount ] = events.balances.withdraw.v9122.decode(event)
            rec = { from: who, to: '', amount }
          }
          else if(events.balances.withdraw.v9130.is(event)) {
            let { who, amount } = events.balances.withdraw.v9130.decode(event)
            rec = { from: who, to: '', amount }
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;

        case events.balances.reserveRepatriated.name: // 'Balances.ReserveRepatriated': // TODO check if this is really a transfer?
          if(events.balances.reserveRepatriated.v2008.is(event)) {
            let [ from, to, amount, balanceStatus ] = events.balances.reserveRepatriated.v2008.decode(event)
            rec = { from, to, amount }
          }
          else if(events.balances.reserveRepatriated.v9130.is(event)) {
            let { from, to, amount, destinationStatus } = events.balances.reserveRepatriated.v9130.decode(event)
            rec = { from, to, amount }
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;

        case events.balances.transfer.name: // 'Balances.Transfer':
          if (events.balances.transfer.v1020.is(event)) {
            let [from, to, amount] = events.balances.transfer.v1020.decode(event)
            rec = {from, to, amount}
          }
          else if (events.balances.transfer.v1050.is(event)) {
            let [from, to, amount] = events.balances.transfer.v1050.decode(event)
            rec = {from, to, amount}
          }
          else if (events.balances.transfer.v9130.is(event)) {
            rec = events.balances.transfer.v9130.decode(event)
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;

        case events.staking.reward.name: // 'Staking.Reward':
          if(events.staking.reward.v1020.is(event)) {
           /*
            *  All validators have been rewarded by the first balance; the second is the remainder
            *  from the maximum amount of reward.
            *  FIXME: how do we determine the validators...?
            */
            let [ amount, remainder ] = events.staking.reward.v1020.decode(event)
            let validator = ''
            rec = { from: '', to: validator, amount }
            console.warn(`block: ${block.header.height} FIXME: how do we determine the validators...?`)
            saveToDb = false
          }
          else if (events.staking.reward.v1050.is(event)) {
            let [ validator, amount ] = events.staking.reward.v1050.decode(event)
            rec = { from: '', to: validator, amount }
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;
        case events.staking.rewarded.name: // 'Staking.Rewarded':
          if(events.staking.rewarded.v9090.is(event)) {
            let [ stash, amount ] = events.staking.rewarded.v9090.decode(event)
            rec = { from: '', to: stash, amount }
            // FIXME: check if there is a balances.Deposit event for this amount
          }
          else if (events.staking.rewarded.v9300.is(event)) {
            let { stash, amount } = events.staking.rewarded.v9300.decode(event)
            rec = { from: '', to: stash, amount }
            // FIXME: check if there is a balances.Deposit event for this amount
          }
          else {
            throw new Error('Unsupported spec')
          }
          break;
        // not needed
        // case 'Balances.Reserved':
        // case 'Balances.Unreserved':
        default:
          saveToDb = false
          break;
      }

      // if (event.name == events.balances.transfer.name) {
      //   let rec: {from: string; to: string; amount: bigint}
      //   if (events.balances.transfer.v1020.is(event)) {
      //     let [from, to, amount] = events.balances.transfer.v1020.decode(event)
      //     rec = {from, to, amount}
      //   }
      //   else if (events.balances.transfer.v1050.is(event)) {
      //     let [from, to, amount] = events.balances.transfer.v1050.decode(event)
      //     rec = {from, to, amount}
      //   }
      //   else if (events.balances.transfer.v9130.is(event)) {
      //     rec = events.balances.transfer.v9130.decode(event)
      //   }
      //   else {
      //     throw new Error('Unsupported spec')
      //   }

      //   assert(block.header.timestamp, `Got an undefined timestamp at block ${block.header.height}`)

      //   transfers.push({
      //     id: event.id,
      //     blockNumber: block.header.height,
      //     timestamp: new Date(block.header.timestamp),
      //     extrinsicHash: event.extrinsic?.hash,
      //     section,
      //     method,
      //     from: ss58.codec('kusama').encode(rec.from),
      //     to: ss58.codec('kusama').encode(rec.to),
      //     amount: rec.amount,
      //     fee: event.extrinsic?.fee || 0n,
      //   })
      // }

      if (saveToDb) {
        // console.debug(`Saving event ${event.name} at block ${block.header.height}, ${block.header.timestamp}}`)
        assert(block.header.timestamp?.toString(), `Got an undefined timestamp at block ${block.header.height}`)
        // console.debug(section, method, rec.from, rec.to, rec.amount)
        const timestamp = new Date(block.header.timestamp || '')
        transfers.push({
          // id: event.index.toString(),
          id: event.id, // "0005743706-28e3c-000011" // height - ?? - index
          chainId: CHAIN_ID,
          blockNumber: block.header.height,
          timestamp,
          // extrinsicId: `${event.extrinsic?.index}/${event.extrinsic?.id}`, // "0003097318-3a028-000003" // height - ?? - index
          extrinsicId: event.extrinsic?.id, // "0003097318-3a028-000003" // height - ?? - index
          extrinsicHash: event.extrinsic?.hash,
          section,
          method,
          // e_section: event.extrinsic,
          from: rec.from ? ss58.codec('kusama').encode(rec.from) : '',
          to: rec.to ? ss58.codec('kusama').encode(rec.to) : '',
          amount: rec.amount,
          fee: event.extrinsic?.fee || 0n,
        })
      }
    } // for (let event of block.events) {
  } // for (let block of ctx.blocks) {
  return transfers
}

async function createAccounts(ctx: ProcessorContext<Store>, transferEvents: TransferEvent[]): Promise<Map<string,Account>> {
  const accountIds = new Set<string>()
  for (let t of transferEvents) {
    accountIds.add(t.from)
    accountIds.add(t.to)
  }

  const accounts = await ctx.store.findBy(Account, {id: In([...accountIds])}).then((accounts) => {
    return new Map(accounts.map((a) => [a.id, a]))
  })

  for (let t of transferEvents) {
    updateAccounts(t.from)
    updateAccounts(t.to)
  }

  function updateAccounts(id: string): void {
    const acc = accounts.get(id)
    if (acc == null) {
      accounts.set(id, new Account({id}))
    }
  }

  return accounts
}

function createTransfers(transferEvents: TransferEvent[], accounts: Map<string, Account>): Transfer[] {
  let transfers: Transfer[] = []
  for (let t of transferEvents) {
    let {id, chainId, blockNumber, timestamp, extrinsicId, extrinsicHash, method, section, amount, fee} = t
    let from = accounts.get(t.from)
    let to = accounts.get(t.to)
    transfers.push(new Transfer({
      id,
      chainId,
      blockNumber,
      timestamp,
      extrinsicId,
      extrinsicHash,
      method,
      section,
      from,
      to,
      amount,
      fee,
    }))
  }
  return transfers
}
