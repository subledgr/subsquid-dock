
import { Block, Extrinsic, TransferEvent } from './main'
// export class CPolkastoreUtils {

//   constructor() {
//   }

//   // --------------------------------------------------------------
//   // calculates totalFee, feeBalances and feeTreasury
//   // private CalcTotalFee(data: TBlockData, ex: IExtrinsic, tx: TTransaction): boolean {
//   private CalcTotalFee(data: Block, ex: Extrinsic, tx: TransferEvent): boolean {
//       if (!ex.paysFee)
//       return true;

//     if (!data.isRelayChain || !tx.specVersion)
//       return false;

//     // filter events: determine only those that are necessary for the fee calculation
//     const events = this.FilterEvents(ex, tx);
//     if (!events.length)
//       return false;

//     const fee_old = this.CalcTotalFee_pre9120(events, tx);    // sum of feeBalances and feeTreasury
//     let fee = fee_old;

//     if (tx.specVersion >= 9120) {
//       const fee_new = this.CalcTotalFee_9120(events, tx);     // consider balances.Withdraw

//       if (fee_new.totalFee)                                   // use only, if successfull
//         fee = fee_new;

//       // Error Check
//       if (fee_old.totalFee && fee_old.totalFee != fee.totalFee)
//         this.ErrorOutEx(tx.id, 'old: total fee: ' + fee_old.totalFee + ' new total fee: ' + fee_new.totalFee, false, true);
//     }

//     tx.totalFee = fee.totalFee;
//     tx.feeBalances = fee.feeBalances;
//     tx.feeTreasury = fee.feeTreasury;

//     return tx.totalFee != undefined;
//   }

//   // --------------------------------------------------------------
//   // looks for balance.Deposit method with fee infomation and sets this in tx
//   // calculates totalFee as sum of feeBalances and feeTreasury
//   // the feeBalances goes to the block author, feeTreasury to the treasury
//   private CalcTotalFee_pre9120(events: ISanitizedEvent[], tx: TTransaction): TFee {
//     const ret: TFee = {
//       totalFee: undefined,
//       feeBalances: undefined,
//       feeTreasury: undefined
//     };

//     events.forEach((ev: ISanitizedEvent) => {
//       if (ev.method == 'balances.Deposit' && ev.data[0].toString() == tx.authorId) {  // calc fees for block author
//         ret.feeBalances = (ret.feeBalances || BigInt(0)) + BigInt(ev.data[1].toString());
//       }
//       else if (ev.method == 'treasury.Deposit') {
//         ret.feeTreasury = (ret.feeTreasury || BigInt(0)) + BigInt(ev.data[0].toString());
//       }
//     });

//     if (ret.feeBalances || ret.feeTreasury)
//       ret.totalFee = (ret.feeBalances || BigInt(0)) + (ret.feeTreasury || BigInt(0));
//     return ret;
//   }

//   // --------------------------------------------------------------
//   // starting with runtime 9120 there is a balances.Withdraw event containing the total fee
//   private CalcTotalFee_9120(events: ISanitizedEvent[], tx: TTransaction): TFee {
//     const ret: TFee = {
//       totalFee: undefined,
//       feeBalances: undefined,
//       feeTreasury: undefined
//     };

//     const myBlock = tx.senderId == tx.authorId; // a special condition

//     events.forEach((ev: ISanitizedEvent) => {
//       // the fee payment of the sender (initial fee):
//       if (ev.method == 'balances.Withdraw' && ev.data[0].toString() == tx.senderId) {
//         if (!ret.totalFee)  // first balances.Withdraw only
//           ret.totalFee = BigInt(ev.data[1].toString());
//       }
//       // maybe there is a refund to the sender because the final fee is lower than the initial fee:
//       else if (!myBlock && ev.method == 'balances.Deposit' && ev.data[0].toString() == tx.senderId && ret.totalFee) {
//         const v = BigInt(ev.data[1].toString());
//         if (v <= ret.totalFee)
//           ret.totalFee -= v;
//       }
//       // fee part going to Treasury:
//       else if (ev.method == 'treasury.Deposit') {
//         ret.feeTreasury = BigInt(ev.data[0].toString());
//       }
//     });

//     if (ret.totalFee)
//       ret.feeBalances = ret.totalFee - (ret.feeTreasury || BigInt(0));
//     return ret;
//   }

//   // --------------------------------------------------------------
//   // filter all events according to necessity for the fee calculation
//   // needed: balances.Withdraw, balances.Deposit, treasury.Deposit
//   // additionally filter uot needed balances.Deposit events:
//   // 1. 'balances.Deposit' events which are related to an "staking.Rewarded" event
//   // 2. duplicate 'balances.Deposit' events (runtime 9120...9130 only)
//   private FilterEvents(ex: IExtrinsic, tx: TTransaction): ISanitizedEvent[] {
//     const ret: ISanitizedEvent[] = [];

//     let last: ISanitizedEvent | undefined;
//     ex.events.forEach((ev: ISanitizedEvent) => {
//       if (ev.method == 'balances.Withdraw' || ev.method == 'treasury.Deposit') {
//         ret.push(last = ev);
//         return;
//       }

//       // case 1: 'balances.Deposit' events which are related to an "staking.Rewarded" event
//       if (ev.method == 'staking.Rewarded') {
//         if (last && last.method == 'balances.Deposit' && ev.data[1].toString() == last.data[1].toString()) {
//           ret.pop();
//           last = undefined;
//         }
//         return;
//       }

//       // case 2: duplicate 'balances.Deposit' events
//       if (ev.method == 'balances.Deposit') {
//         if (tx.specVersion && tx.specVersion >= 9120 && tx.specVersion < 9130 &&
//           last && last.method == 'balances.Deposit' && ev.data[1].toString() == last.data[1].toString())
//           return;
//         else
//           ret.push(last = ev);
//       }
//     });
//     return ret;
//   }


// }
