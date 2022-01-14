import fetch from 'node-fetch';
import fs from 'fs';
import { address_ledger, address_main, alchemy_api_url, starting_block } from './config.js';
import { historical_eth_prices } from './helper.js';

export { sort_transactions_from_list, get_and_write_transfers, write_transfer_transactions_map, get_transfer_transactions, get_transfer_transactions_from_file, get_timestamp, match_actions, write_actions, sort_transactions_from_map };

// function thats fetching the data from the api
export interface Transfer {
    type: string;
    hash: string;
    blockNum: string;
    from: string;
    to: string;
    value: number;
    erc721TokenId: string;
    asset: string;
    category: string;
}

export interface TransferTransaction {
    hash: string;
    status: number;
    author: string;
    gasFee: number;
    blockNum: string;
    transfers: Transfer[];
    timestamp: string;
}

interface Action {
    type: string;
    hash: string;
    blockNum: string;
    timestamp: string;
    asset_and_id: string;
    value_eth: number;
    value_cad: number;
}

async function get_transfer_transactions() {

    const transactions = new Map();

    // DATA TO
    const transfers_to_main = await get_transfers_for_address(address_main, "in");
    await add_transfers_to_transaction(transactions, transfers_to_main, "in");
    const transfers_to_ledger = await get_transfers_for_address(address_ledger, "in");
    await add_transfers_to_transaction(transactions, transfers_to_ledger, "in");
    const transfers_from_main = await get_transfers_for_address(address_main, "out");
    await add_transfers_to_transaction(transactions, transfers_from_main, "out");
    const transfers_from_ledger = await get_transfers_for_address(address_ledger, "out");
    await add_transfers_to_transaction(transactions, transfers_from_ledger, "out");

    // console.log(transactions);

    return transactions;
}



// function that adds transactions to a bundled transaction
async function add_transfers_to_transaction(transactions: Map<string, TransferTransaction>, transfers: Transfer[], type: string) {
    for (const transfer of transfers) {
        transfer.type = type;
        const timestamp = await get_timestamp(transfer.blockNum);
        const transactionReceipt = await get_transaction_receipt(transfer.hash);
        let status = 0;
        if (transactionReceipt.root) {
            status = 1;
        } else {
            status = transactionReceipt.status;
        }
        const blockNumDec = parseInt(transfer.blockNum, 16).toString();
        const gasPrice = await get_gas_price(transfer.hash);
        const gasFee = parseInt(transactionReceipt.gasUsed, 16) * gasPrice / 1000000000;
        const author = transactionReceipt.from;

        if (!transactions.has(transfer.hash)) {
            const new_transaction = {
                hash: transfer.hash,
                status,
                gasFee,
                author,
                blockNum: blockNumDec,
                transfers: [transfer],
                timestamp,
            }
            transactions.set(transfer.hash, new_transaction);
        } else {
            transactions.get(transfer.hash).transfers.push(transfer);
        }
    }
}

const last_block_tax_season_lafleur = 13717840;

// function thata gets transactions for a specific address
async function get_transfers_for_address(address: string, type: string) {
    const fromBlock = "0x" + (starting_block).toString(16)
    // const toBlock = "0x" + (starting_block + 1).toString(16)
    const toBlock = "0x" + (last_block_tax_season_lafleur).toString(16);

    let params
    if (type === "in") {
        params = {
            "fromBlock": fromBlock,
            "toBlock": toBlock,
            "toAddress": address,
            "category": ["internal", "external", "erc20", "erc721", "erc1155"],
        }
    } else {
        params = {
            "fromBlock": fromBlock,
            "toBlock": toBlock,
            "fromAddress": address,
            "category": ["internal", "external", "erc20", "erc721", "erc1155"],
        }
    }


    // DATA FROM
    const response_from = await fetch(alchemy_api_url, {
        method: 'POST',
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "id": 0,
            "method": "alchemy_getAssetTransfers",
            "params": [params],
        }),
    });

    const data_from = await response_from.json() as any;
    const transfers = data_from.result.transfers;
    return transfers;
}


// function that matches transfers with the same token id
function match_actions(actions: Action[]) {
    const asset_map = new Map();

    for (const action of actions) {
        if (action.asset_and_id) {

            if (!asset_map.has(action.asset_and_id)) {
                asset_map.set(action.asset_and_id, [action]);
            } else {
                asset_map.get(action.asset_and_id).push(action);
            }
        }

    }
    // console.log("asset", asset_map);

    // write asset map to file
    const asset_obj = Object.fromEntries(asset_map);
    fs.writeFileSync('assets.json', JSON.stringify(asset_obj, null, 2));

    return asset_map;
}

// function that creates actions from the transactions
function create_actions(transactions: any[]) {
    const price_data = historical_eth_prices();
    const actions = [] as Action[];
    for (const transaction of transactions) {

        // transform hex timestamp to date
        const date = new Date(parseInt(transaction.timestamp, 16) * 1000);
        // keep only year, month, day form date
        const date_string = date.toISOString().slice(0, 10);
        transaction.date = date_string;
        // console.log("date:", date_string);
        const eth_price = price_data.get(date_string);

        let value = 0;
        const asset_ids = [] as string[];
        let type = "";
        let asset_in = "";
        let asset_out = "";

        for (const transfer of transaction.transfers) {

            if (transfer.erc721TokenId || transfer.erc1155Metadata) {

                let token_id;
                let asset;
                let amount = 0;
                if (transfer.erc721TokenId) {
                    token_id = parseInt(transfer.erc721TokenId, 16);
                    asset = transfer.asset
                    amount = 1;
                } else if (transfer.erc1155Metadata) {
                    token_id = parseInt(transfer.erc1155Metadata[0].tokenId, 16);
                    asset = transfer.rawContract.address.toLowerCase();
                    amount = parseInt(transfer.erc1155Metadata[0].value, 16);
                }

                const asset_and_id = asset + "#" + token_id;

                if (transfer.type === "in") {
                    if (transfer.to == address_main || transfer.to == address_ledger) {
                        asset_in = asset_and_id;
                        if (!type) {
                            type = "transfer_in"
                        } else {
                            if (asset_in == asset_out) {
                                type = "transfer_in_and_out"
                            } else {
                                type = "swap"
                            }
                        }

                    }
                }
                else if (transfer.type === "out") {
                    if (transfer.from == address_main || transfer.from == address_ledger) {
                        asset_out = asset_and_id;
                        if (!type) {
                            type = "transfer_out"
                        } else {
                            if (asset_in == asset_out) {
                                type = "transfer_in_and_out"
                            } else {
                                type = "swap"
                            }
                        }
                    }
                }

                // if (type) {
                //   if (transfer.type === "out") {
                //     type = "sell";
                //   } else {
                //     type = "buy";
                //   }
                // } else {
                //   type = "in_out"
                // }

                // token_id from hex

                if (!asset_ids.includes(asset_and_id)) {
                    for (let i = 0; i < amount; i++) {
                        asset_ids.push(asset_and_id);
                    }
                }
                // console.log("asset_and_id", asset_and_id);
            }
            else {
                if (transfer.asset == "WETH" || transfer.asset == "ETH") {
                    const eth_value = parseFloat(transfer.value);
                    // console.log("value", transfer.value, "eth_value", eth_value);
                    if (transfer.type === "out") {
                        value -= eth_value;
                    } else {
                        value += eth_value;
                    }
                }
                else {
                    // console.log("asset not found", transfer.asset);
                }
            }

        }


        value = value / asset_ids.length;
        for (const asset_id of asset_ids) {
            if (!type) {
                type = "undefined"
            }

            if (value != 0) {
                if (type == "transfer_out") {
                    type = "sale"
                }
                else if (type == "transfer_in") {
                    type = "buy"
                }
            }

            const action = {
                hash: transaction.hash,
                blockNum: transaction.blockNum,
                timestamp: transaction.timestamp,
                type,
                asset_and_id: asset_id,
                value_eth: value,
                value_cad: value * eth_price,
            } as Action;


            actions.push(action);
        }

    }

    // save actions to file
    write_actions(actions);

    return actions;
}

// function that writes actions to a file
function write_actions(actions: Action[]) {
    fs.writeFileSync('actions.json', JSON.stringify(actions, null, 2));
    // for (const action of actions) {
    //   fs.appendFileSync('actions.csv', `${action.hash},${action.blockNum},${action.timestamp},${action.type},${action.asset_and_id},${action.value_eth},${action.value_cad}\n`);
    // }
}


// function that sorts the transactions from a map by block number
function sort_transactions_from_map(transactions_map: Map<string, TransferTransaction>) {
    const transactions = [] as TransferTransaction[];
    for (const [key, value] of transactions_map) {
        transactions.push(value);
    }

    transactions.sort((a, b) => {
        return Number(a.blockNum) - Number(b.blockNum);
    });

    return transactions;
}

// function that sorts transactions from a list by block number
function sort_transactions_from_list(transactions: TransferTransaction[]) {
    transactions.sort((a, b) => {
        return Number(a.blockNum) - Number(b.blockNum);
    });
    return transactions;
}

async function get_transfer_transactions_from_file() {
    const data = fs.readFileSync('transactions.json');
    const hashes_obj = JSON.parse(data.toString()) as TransferTransaction[];
    const hashes_list = [] as TransferTransaction[];
    for (const i in hashes_obj) {
        const new_obj = {
            hash: hashes_obj[i].hash,
            status: hashes_obj[i].status,
            author: hashes_obj[i].author,
            gasFee: hashes_obj[i].gasFee,
            blockNum: hashes_obj[i].blockNum,
            transfers: hashes_obj[i].transfers,
            timestamp: hashes_obj[i].timestamp,
        }
        hashes_list.push(new_obj);
    }
    // const hashes_map = Object.fromEntries(hashes_obj);
    // console.log(hashes_list);

    return hashes_list;
}

// function that gets transactions and writes them to a file
function write_transfer_transactions_map(hashes_map: Map<any, any>) {
    // console.log(hashes_map);
    const hashes_obj = Object.fromEntries(hashes_map);
    fs.writeFileSync('transactions.json', JSON.stringify(hashes_obj, null, 2));
}

// function that writes assets to a csv file
function write_assets(assets: Map<string, Action[]>) {
    let csv_string = "asset_and_id,hash,blockNum,date,type,value_eth,value_cad,profit,item_profit\n";
    let total_profit = 0;
    const assets_obj = Object.fromEntries(assets);
    // console.log("assets_obj:", assets_obj);
    for (const asset_and_id of Object.keys(assets_obj)) {
        const actions = assets.get(asset_and_id) as Action[];
        let item_profit = 0;
        const buying_prices = [] as number[];

        let wasSold = false;
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            let profit = 0;

            if (action.type == "buy") {
                buying_prices.push(action.value_cad);
            }
            else if (action.type === "sale") {
                let buying_price = 0
                if (buying_prices.length > 0) {
                    buying_price = Math.min(...buying_prices);
                } else {
                    console.log("no buying price for sale", action.hash);
                }
                profit = action.value_cad + buying_price;
                item_profit += profit;
                wasSold = true;
            }
            let first_col;
            if (i == 0) {
                first_col = asset_and_id
            }
            else {
                first_col = ""
            }
            const date = new Date(parseInt(action.timestamp, 16) * 1000);

            csv_string += first_col + "," + action.hash + "," + action.blockNum + "," + date + "," + action.type + "," + action.value_eth + "," + action.value_cad + "," + profit;


            if (i == actions.length - 1) {
                if (item_profit) {

                    total_profit += item_profit;
                }
                console.log("item_profit", item_profit);
                csv_string += "," + item_profit + "\n";;
            } else {
                csv_string += "\n";
            }

        }
    }
    csv_string += "       total_profit:" + "," + "," + "," + "," + "," + "," + "," + total_profit + "\n";
    fs.writeFileSync('assets.csv', csv_string);
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

// function that gets the transaction status from the transaction hash
async function get_transaction_receipt(hash: string) {
    const response = await fetch(alchemy_api_url, {
        method: 'POST',
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "id": 0,
            "method": "eth_getTransactionReceipt",
            "params": [
                hash
            ],
        }),
    });
    const data = await response.json() as any;
    return data.result;
}

// function that gets the gas price from the transaction hash
async function get_gas_price(hash: string) {
    const response = await fetch(alchemy_api_url, {
        method: 'POST',
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "id": 0,
            "method": "eth_getTransactionByHash",
            "params": [
                hash
            ],
        }),
    });
    const data = await response.json() as any;
    return parseInt(data.result.gasPrice, 16) / 1000000000;
}

async function get_and_write_transfers() {
    // const transactions_raw = await get_transfer_transactions();
    // write_transfer_transactions_map(transactions_raw)

    const transactions = await get_transfer_transactions_from_file();
    // console.log("transactions:", transactions[0].transfers);

    const sorted_transactions = sort_transactions_from_list(transactions);

    const actions = create_actions(sorted_transactions);
    const asset_map = match_actions(actions);
    write_assets(asset_map);
}
