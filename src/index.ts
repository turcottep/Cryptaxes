import fetch from 'node-fetch';
import fs from 'fs';
import { address_ledger, address_main, etherscan_api_key, starting_block, ending_block } from './config.js';
import { historical_eth_prices } from './helper.js';
import { get_and_write_transfers, get_transfer_transactions, get_transfer_transactions_from_file, sort_transactions_from_map, Transfer, TransferTransaction, write_transfer_transactions_map } from './transfer.js';
import { text } from 'stream/consumers';
import { main_helixir } from './helixir.js';


interface EtherScanTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  confirmations: string;
}


// function that gets transactions for a specific address
async function get_transactions_for_address(address: string) {
  const normal_transactions = await get_transactions_from_etherscan(address, starting_block, ending_block, 'txlist');
  // const internal_transactions = await get_transactions_from_etherscan(address, starting_block, 'latest', 'txlistinternal');
  // const erc20_transactions = await get_transactions_from_etherscan(address, starting_block, 'latest', 'tokentx');
  // const erc721_transactions = await get_transactions_from_etherscan(address, starting_block, 'latest', 'tokennfttx');
  return normal_transactions;
}

// function that does a call to the etherscan api and gets all transactions for a specific address
async function get_transactions_from_etherscan(address: string, start_block: number, end_block: number | string, action: string) {
  const url = "https://api.etherscan.io/api?module=account&action=" + action + "&address=" + address + "&startblock=" + start_block + "&endblock=" + end_block + "&page=1&offset=0&sort=asc&apikey=" + etherscan_api_key;
  const response = await fetch(url);
  try {
    const data = await response.json() as any;
    const transactions = data.result as EtherScanTransaction[];
    return transactions;
  } catch (error) {
    console.log(response);
    console.log(error);
  }

}


// // function that gets the gas fee from the transaction hash
// async function get_gas_fee(hash: string) {
//   const response = await fetch(alchemy_api_url, {
//     method: 'POST',
//     body: JSON.stringify({
//       "jsonrpc": "2.0",
//       "id": 0,
//       "method": "alchemy_getTransaction",
//       "params": [{
//         "hash": hash,
//       }],
//     }),
//   });
//   const data = await response.json() as any;
//   const gas_fee = data.result.gasFee;
//   return gas_fee;
// }


// function that writes transactions to file
function write_transactions(transactions: any[]) {
  const json_transactions = JSON.stringify(transactions, null, 2);
  fs.writeFileSync('transactions_etherscan.json', json_transactions);
}


// function that reads transactions from file
function read_transactions_from_file() {
  const transactions = JSON.parse(fs.readFileSync('transactions_etherscan.json', 'utf8'));
  return transactions;
}

// function that gets the historical cad price of eth on the day of the transaction and adds it to the transaction
async function add_cad_price_to_transaction(transactions: any[]) {

  const price_data = historical_eth_prices();

  let average_eth_price = 0;
  let eth_balance = 0;
  let total_profit = 0;
  let total_gas_fee = 0;
  let total_gas_fee_cad = 0;

  for (const tx of transactions) {

    // // skip if not from or to address_main
    // if (tx.from !== address_main && tx.to !== address_main) {
    //   continue;
    // }



    // transform hex timestamp to date
    const dateInt = parseInt(tx.timestamp, 16);
    const date = new Date(dateInt * 1000);
    // keep only year, month, day form date
    const date_string = date.toISOString().slice(0, 10);

    tx.date = date_string;
    // console.log("date:", date_string);
    const eth_price = price_data.get(date_string);
    // console.log("eth_price:", eth_price);
    tx.cad_price = eth_price;

    let eth_diff = 0;

    if (tx.author === address_main || tx.author === address_ledger) {
      eth_diff -= tx.gasFee;
      total_gas_fee += tx.gasFee;
      total_gas_fee_cad += tx.gasFee * tx.cad_price;
      tx.total_gas_fee = total_gas_fee;
      tx.total_gas_fee_cad = total_gas_fee_cad;
    }

    for (const transfer of tx.transfers) {

      let profit = 0;

      if (transfer.asset === "CARTE") {
        transfer.erc721TokenId = parseInt(transfer.rawContract.value, 16);
        transfer.category = "erc721";
      }
      else if (transfer.asset === "ETH") {
        if (transfer.to == "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2") {
          transfer.description = "weth_wrap";
          transfer.amount = transfer.value;
          transfer.value = 0;
        }
        else if (transfer.from == "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2") {
          transfer.description = "weth_unwrap";
          transfer.amount = transfer.value;
          transfer.value = 0;
        }
      }

      // console.log("transfer:", transfer);

      if ((transfer.category == "internal" || transfer.category == "external") || (transfer.category == "erc20" && transfer.asset === "WETH")) {

        transfer.amount = "";
        transfer.tokenId = "";

        if (tx.status == 1) {

          // tx.gas_fee = tx.gasPrice * tx.gasUsed;
          // tx.gas_fee_cad = tx.gas_fee / 1000000000000000000 * eth_price;

          // if ((transfer.to == address_main || transfer.from == address_main)) {
          // console.log("yoo");

          if (transfer.type == "in") {
            // type = "in"
            eth_diff += transfer.value;

            average_eth_price = (average_eth_price * eth_balance + transfer.value * eth_price) / (eth_balance + transfer.value);
          }
          else if (transfer.type == "out") {
            // type = "out"
            profit = (eth_price - average_eth_price) * (transfer.value);

            transfer.value = -transfer.value;
            eth_diff += transfer.value;

          }
          transfer.cad_value = transfer.value * eth_price;
        }

        // }


      } else if (transfer.category == "erc721" || transfer.erc721TokenId) {
        transfer.category = "erc721";
        transfer.amount = 1;
        transfer.asset += " | " + transfer.rawContract.address;
        transfer.tokenId = parseInt(transfer.erc721TokenId, 16);

      } else if (transfer.category == "erc20") {
        transfer.amount = transfer.value;
        transfer.value = ""
        transfer.tokenId = ""


      } else if (transfer.category == "erc1155") {

        transfer.amount = transfer.erc1155Metadata[0].value;
        transfer.tokenId = parseInt(transfer.erc1155Metadata[0].tokenId, 16);
        transfer.asset = transfer.rawContract.address;
      }

      if (eth_diff != 0) {
        eth_balance += eth_diff;
        transfer.eth_diff = eth_diff;
        transfer.eth_balance = eth_balance;
        eth_diff = 0;
      }

      if (!transfer.value) transfer.value = "";
      if (!transfer.cad_value && transfer.cad_value !== 0) transfer.cad_value = "";
      if (!transfer.eth_balance) transfer.eth_balance = "";
      if (!transfer.eth_diff) transfer.eth_diff = "";
      transfer.profit = profit;
      total_profit += profit;
      tx.total_profit = total_profit;
    }
    tx.average_eth_price = average_eth_price;
    tx.eth_balance = eth_balance;
  }
  console.log("eth_balance:", eth_balance);
  console.log("total_profit:", total_profit);
  console.log("total_gas_fee_cad:", total_gas_fee_cad);
  transactions[transactions.length - 1].total_gas_fee_cad = total_gas_fee_cad;

}

// function that writes transactions to a csv file
function write_transactions_to_csv(transactions: any[]) {
  let csv_string = "date, hash, from, to, status, type, value, gas fee, eth_diff ,eth_balance, historical cad price, average price, cad profit, category, asset, description, amount, tokenId, cad price, cad value\n";
  for (const tx of transactions) {
    let first = true;
    for (const transfer of tx.transfers) {
      if (first) {
        csv_string += tx.date + "," + tx.hash + "," + transfer.from + "," + transfer.to + "," + tx.status + "," + transfer.type + "," + transfer.value + "," + tx.gasFee + "," + transfer.eth_diff + "," + transfer.eth_balance + "," + tx.cad_price + "," + tx.average_eth_price + "," + transfer.profit + "," + transfer.category + "," + transfer.asset + "," + transfer.description + "," + transfer.amount + "," + transfer.tokenId + "," + transfer.cad_value + "\n";
        first = false;
      } else {
        csv_string += "," + "," + transfer.from + "," + transfer.to + "," + "," + transfer.type + "," + transfer.value + "," + "," + transfer.eth_diff + "," + transfer.eth_balance + "," + "," + "," + transfer.profit + "," + transfer.category + "," + transfer.asset + "," + transfer.description + "," + transfer.amount + "," + transfer.tokenId + "," + tx.cad_price + "," + transfer.cad_value + "\n";
      }
    }
    csv_string += "\n";
  }
  // add total profit from last transaction
  csv_string += ", profit(cad), gas fees(cad)\n";
  csv_string += "total profit ," + transactions[transactions.length - 1].total_profit + "," + transactions[transactions.length - 1].total_gas_fee_cad + "," + "\n";

  fs.writeFileSync('transactions_etherscan.csv', csv_string);
}


async function create_transaction_map_from_etherscan_and_transfers(transfer_transactions: TransferTransaction[], etherscan_transactions: EtherScanTransaction[]) {
  const transactions_map = new Map<string, TransferTransaction>();

  for (const tx of transfer_transactions) {
    transactions_map.set(tx.hash, tx);
  }

  for (const tx of etherscan_transactions) {
    if (!transactions_map.has(tx.hash)) {

      const transfer = {
        date: "",
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        status: tx.txreceipt_status,
        type: "",
        value: Number(tx.value) / 1000000000000000000,
        gasFee: "",
        eth_balance: "",
        category: "external",
        asset: "",
        amount: "",
        tokenId: "",
        cad_price: "",
        cad_value: "",
        blockNum: tx.blockNumber,
        erc721TokenId: "",
      } as Transfer
      // timstamp to hex (13232 to 0x5b2)
      const timeStampHex = Number(tx.timeStamp).toString(16);
      const transaction = {
        hash: tx.hash,
        status: Number(tx.txreceipt_status),
        author: tx.from,
        gasFee: Number(tx.gasPrice) * Number(tx.gasUsed) / 1000000000000000000,
        blockNum: tx.blockNumber,
        transfers: [transfer],
        timestamp: timeStampHex,
      } as TransferTransaction;
      transactions_map.set(tx.hash, transaction);
    }
  }
  return transactions_map;
}

async function main() {
  console.log("ledger address", address_ledger);

  const transactions_etherscan_main = await get_transactions_for_address(address_main)
  // console.log("transactions:", transactions_etherscan_main);

  const transactions_etherscan_ledger = await get_transactions_for_address(address_ledger)
  const all_etherscan_transactions = transactions_etherscan_main.concat(transactions_etherscan_ledger);
  // write_transactions(transactions_main);

  // console.log("transactions_main:", transactions_main);

  // write_transactions_to_csv(transactions_main);

  // const transactions_raw = await get_transfer_transactions();
  // write_transfer_transactions_map(transactions_raw)

  const transactions = await get_transfer_transactions_from_file();


  // console.log("transactions_map:", transactions_map);


  // // console.log("transactions:", transactions);

  // // console.log("transactions:", transactions);

  const transactions_map = await create_transaction_map_from_etherscan_and_transfers(transactions, all_etherscan_transactions);

  const sorted_transactions = sort_transactions_from_map(transactions_map);
  add_cad_price_to_transaction(sorted_transactions);
  // console.log("transactions:", transactions);
  write_transactions_to_csv(sorted_transactions);

  // get_and_write_transfers()

  console.log("done");


}

// main();

main_helixir()


