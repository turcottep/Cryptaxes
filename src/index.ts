import fetch from 'node-fetch';

import fs from 'fs';

// function thats fetching the data from the api
interface Transaction {
  type: string;
  hash: string;
  blockNum: string;
  from: string;
  to: string;
  value: string;
  erc721TokenId: string;
  asset: string;
  category: string;
}

interface BundledTransaction {
  hash: string;
  blockNum: string;
  in: Transaction[];
  out: Transaction[];
  timestamp: string;
}

const alchemy_api_url = "https://eth-mainnet.alchemyapi.io/v2/Sb4CeL4EzyZ-j_QrNFWgP2963hPvJ51Z"


async function get_transactions() {
  const fromBlock = "0x" + (13398055).toString(16)
  console.log(fromBlock);

  const hashes = new Map();

  // DATA TO

  const response_to = await fetch(alchemy_api_url, {
    method: 'POST',
    body: JSON.stringify({
      "jsonrpc": "2.0",
      "id": 0,
      "method": "alchemy_getAssetTransfers",
      "params": [{
        "fromBlock": fromBlock,
        "toBlock": "latest",
        "toAddress": "0x0d7C9DB889858b9F6954608e36199104Dd530dA0",
        // "maxCount": "0x5",
        // "category": [
        //   "token"
        // ]
      }],

    }),
  });

  const data_to = await response_to.json() as any;
  console.log(data_to);
  const transfers_from = data_to.result.transfers as Transaction[];
  for (const transfer of transfers_from) {
    const timestamp = await get_timestamp(transfer.blockNum);
    if (!hashes.has(transfer.hash)) {
      const hash_transfer = {
        in: [transfer],
        blockNum: transfer.blockNum,
        hash: transfer.hash,
        timestamp,
      }
      hashes.set(transfer.hash, hash_transfer);
    } else {
      if (!hashes.get(transfer.hash).in) {
        hashes.get(transfer.hash).in = [transfer];
      } else {
        hashes.get(transfer.hash).in.push(transfer);
      }
    }
  }

  // DATA FROM
  const response_from = await fetch(alchemy_api_url, {
    method: 'POST',
    body: JSON.stringify({
      "jsonrpc": "2.0",
      "id": 0,
      "method": "alchemy_getAssetTransfers",
      "params": [{
        "fromBlock": fromBlock,
        "toBlock": "latest",
        "fromAddress": "0x0d7C9DB889858b9F6954608e36199104Dd530dA0",
        // "maxCount": "0x5",
        // "category": [
        //   "token"
        // ]
      }],

    }),
  });

  const data_from = await response_from.json() as any;
  console.log(data_from);
  const transfers = data_from.result.transfers as Transaction[];
  for (const transfer of transfers) {
    const timestamp = await get_timestamp(transfer.blockNum);
    if (!hashes.has(transfer.hash)) {
      const hash_transfer = {
        out: [transfer],
        blockNum: transfer.blockNum,
        hash: transfer.hash,
        timestamp,
      }
      hashes.set(transfer.hash, hash_transfer);
    } else {
      if (!hashes.get(transfer.hash).out) {
        hashes.get(transfer.hash).out = [transfer];
      } else {
        hashes.get(transfer.hash).out.push(transfer);
      }
    }
  }


  for (const hash of hashes.keys()) {
    // console.log("HASH = ", hash);
    console.log(hashes.get(hash));
    console.log("\n");
  }

  return hashes;
}


// function that gets transactions and writes them to a file
function write_transactions_map(hashes_map: Map<any, any>) {
  console.log(hashes_map);
  const hashes_obj = Object.fromEntries(hashes_map);
  fs.writeFileSync('transactions.json', JSON.stringify(hashes_obj, null, 2));
}


async function get_transactions_from_file() {
  const data = fs.readFileSync('transactions.json');
  const hashes_obj = JSON.parse(data.toString());
  const hashes_list = [] as BundledTransaction[];
  for (const i in hashes_obj) {
    const new_obj = {
      hash: hashes_obj[i].hash,
      blockNum: hashes_obj[i].blockNum,
      in: hashes_obj[i].in,
      out: hashes_obj[i].out,
      timestamp: hashes_obj[i].timestamp,
    }
    hashes_list.push(new_obj);
  }
  // const hashes_map = Object.fromEntries(hashes_obj);
  console.log(hashes_list);

  return hashes_list;
}

// function that sorts the transactions by block number
function sort_transactions(transactions: any[]) {
  transactions.sort((a, b) => {
    return a.blockNum - b.blockNum;
  });
  return transactions;
}

// functions that writes transactions to a csv file
function write_csv(transactions: any[]) {

  const price_data = read_csv();

  //map that stores the running average of the price
  const price_map = new Map();

  let csv_string = "hash,blockNum,timestamp,date,eth_price,from,to,category_in,value_in,tokenId_in,asset_in,category_out,value_out,tokenId_out,asset_out\n";
  for (const bundled_transaction of transactions) {

    // transform hex timestamp to date
    const date = new Date(parseInt(bundled_transaction.timestamp, 16) * 1000);
    // keep only year, month, day form date
    const date_string = date.toISOString().slice(0, 10);
    console.log("date:", date_string);

    // get eth price at date
    const eth_price = price_data.get(date_string);
    console.log("eth_price:", eth_price);


    const base_csv_string = bundled_transaction.hash + "," + bundled_transaction.blockNum + "," + bundled_transaction.timestamp + "," + date_string + "," + eth_price + ",";

    // add in transactions
    if (bundled_transaction.in) {
      for (const in_transaction of bundled_transaction.in) {
        const price = eth_price * in_transaction.value;
        const asset_and_id = in_transaction.asset + in_transaction.tokenId ? "#" + in_transaction.tokenId : "";
        price_map.set(asset_and_id, price);
        csv_string += base_csv_string + in_transaction.from + "," + in_transaction.to + "," + in_transaction.category + "," + in_transaction.value + "," + in_transaction.erc721TokenId + "," + in_transaction.asset + "\n";
      }
    }

    // add out transactions
    if (bundled_transaction.out) {
      for (const out_transaction of bundled_transaction.out) {
        const asset_and_id = out_transaction.asset + out_transaction.tokenId ? "#" + out_transaction.tokenId : "";
        const price = price_map.get(asset_and_id);
        csv_string += base_csv_string + out_transaction.from + "," + out_transaction.to + ",,,," + "," + out_transaction.category + "," + out_transaction.value + "," + out_transaction.erc721TokenId + "," + out_transaction.asset + "\n";
      }
    }
  }
  fs.writeFileSync('transactions.csv', csv_string);
}

// function that gets timestamp from block number with web3
async function get_timestamp(blockNumHex: string) {
  const response = await fetch(alchemy_api_url, {
    method: 'POST',
    body: JSON.stringify({
      "jsonrpc": "2.0",
      "id": 0,
      "method": "eth_getBlockByNumber",
      "params": [
        blockNumHex,
        true
      ],
    }),
  });
  const data = await response.json() as any;
  return data.result.timestamp;
}


// function that reads price data from a csv file
function read_csv() {
  const data = fs.readFileSync('eth-cad_price.csv');
  const csv_data = data.toString();
  const lines = csv_data.split('\n');

  // map of date to price
  const price_data = new Map();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    // split line by pair of quotes
    const split_line = line.split(/"([^"]+)"/);
    // const split_line = line.split('","');

    // const line_data = line.split('"');
    const date = split_line[1];
    const price = split_line[3].replace(',', '')
    // transform "Apr 01, 2021" date to "2021-04-01"
    const date_obj = new Date(date);
    // keep only year, month, day form date
    const date_string = date_obj.toISOString().slice(0, 10);

    price_data.set(date_string, price);
  }
  console.log(price_data);

  return price_data;
}


async function main() {
  const transactions = await get_transactions_from_file();
  // const transactions = await get_transactions();
  // write_transactions_map(transactions)
  const sorted_transactions = sort_transactions(transactions);
  write_csv(sorted_transactions);
  console.log(sorted_transactions);
  // const price_data = read_csv();
}

main();
