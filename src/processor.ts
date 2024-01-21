import { assertNotNull } from '@subsquid/util-internal'
import { lookupArchive } from '@subsquid/archive-registry'
import {
    BlockHeader,
    DataHandlerContext,
    SubstrateBatchProcessor,
    SubstrateBatchProcessorFields,
    Event as _Event,
    Call as _Call,
    Extrinsic as _Extrinsic
} from '@subsquid/substrate-processor'

// import { events } from './types'
const CHAIN_ID = process.env.CHAIN_ID || 'kusama'
const RPC_ENDPOINT = assertNotNull(process.env.RPC_ENDPOINT) || 'wss://rpc.metaspan.io/dock'
console.log(`CHAIN_ID: ${CHAIN_ID}, RPC_ENDPOINT: ${RPC_ENDPOINT}`)

export const processor = new SubstrateBatchProcessor()
  .setDataSource({
    // Lookup archive by the network name in Subsquid registry

    // See https://docs.subsquid.io/substrate-indexing/supported-networks/
    // there is currently no archive for Dock
    // archive: lookupArchive(CHAIN_ID, { release: 'ArrowSquid' }),

    // Chain RPC endpoint is required on Substrate for metadata and real-time updates
    chain: {
      // Set via .env for local runs or via secrets when deploying to Subsquid Cloud
      // https://docs.subsquid.io/deploy-squid/env-variables/
      url: RPC_ENDPOINT,
      // More RPC connection options at https://docs.subsquid.io/substrate-indexing/setup/general/#set-data-source
      rateLimit: 10,
      capacity: 100,
      requestTimeout: 10000,
    }
  })
  .includeAllBlocks()
  // .setBlockRange({
  //   // // specVersion 1042
  //   // from: 772882,
  //   // to:   772883,
  //   // specVersion 9090 - does not have balances.Withdraw for fees
  //   from: 9000090,
  //   to:   9000097,
  //   // // specVersion 9220
  //   // from: 13000090,
  //   // to:   13000097,
  // })
  .addEvent({
    name: undefined, // All events
    // name: [
    //   // // 'Balances.BalanceSet',
    //   // events.balances.balanceSet.name,
    //   // // 'Balances.Deposit',
    //   // events.balances.deposit.name,
    //   // // 'Balances.DustLost',
    //   // events.balances.dustLost.name,
    //   // // 'Balances.Endowed',
    //   // events.balances.endowed.name,
    //   // // 'Balances.NewAccount',
    //   // events.balances.newAccount.name,
    //   // // 'Balances.ReapedAccount',
    //   // events.balances.reapedAccount.name,
    //   // // 'Balances.Reserved',
    //   // events.balances.reserved.name,
    //   // // 'Balances.ReserveRepatriated',
    //   // events.balances.reserveRepatriated.name,
    //   // // 'Balances.Slashed',
    //   // events.balances.slashed.name,
    //   // // 'Balances.Transfer',
    //   // events.balances.transfer.name,
    //   // // 'Balances.Unreserved',
    //   // events.balances.unreserved.name,
    //   // // 'Balances.Withdraw',
    //   // events.balances.withdraw.name,
    //   // // 'Staking.Reward',
    //   // events.staking.reward.name,
    //   // // 'Staking.Rewarded',
    //   // events.staking.rewarded.name,
    //   // // 'Staking.Slashed',
    //   // events.staking.slashed.name,
    // ],
    call: true,
    // stack: true, // produces http 500...?
    extrinsic: true
  })
  .setFields({
    event: {
      phase: true, // Initilization, ApplyExtrinsic, Finalization
      args: true,
    },
    // https://docs.subsquid.io/sdk/reference/processors/substrate-batch/field-selection/#extrinsics
    extrinsic: {
      hash: true,
      fee: true,
      success: true,
      error: true,
    },
    call: {
      name: true,
      // address: true, // always true
      args: true,
      origin: true, // origin.value.value is the account id of the sender
      // error: true,
      // success: true,
    },
    block: {
      validator: true,
      timestamp: true,
      specVersion: true,
    }
  })
  // Uncomment to disable RPC ingestion and drastically reduce no of RPC calls
  //.useArchiveOnly()

export type Fields = SubstrateBatchProcessorFields<typeof processor>
export type Block = BlockHeader<Fields>
export type Event = _Event<Fields>
export type Call = _Call<Fields>
export type Extrinsic = _Extrinsic<Fields>
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>
