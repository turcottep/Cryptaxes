import { etherscan_api_key, starting_block } from "./config.js";
import fetch from 'node-fetch';
import fs from 'fs';
import { historical_eth_prices, historical_usd_prices } from "./helper.js";


// class with an address and eth in and out, cad in and out, and profit
class Address {
    address: string;
    name: string;
    eth_in: number;
    eth_out: number;
    cad_in: number;
    cad_out: number;
    type: string;
    subtype: string;
    profit: number;
    profit_cad: number;
    constructor(address: string, name: string, type: string, subtype = "") {
        this.address = address;
        this.name = name;
        this.type = type;
        this.subtype = subtype;
        this.eth_in = 0;
        this.eth_out = 0;
        this.cad_in = 0;
        this.cad_out = 0;
        this.profit = 0;
        this.profit_cad = 0;
    }
}

const addresses_owner = {
    "0x34413cF5F58D55FEf9E8b7309B645823a6589cCA": "turcotte_business",
    "0x0d7C9DB889858b9F6954608e36199104Dd530dA0": "turcotte_personal_1",
    "0xd3f8cb07950b95c6406f317fca5ceb154015e2b5": "turcotte_personal_2",
    "0x0da2f3401296427d302326cdf208b79f83abc995": "lafleur_business",
    "0x28200b4d2a67943f47a897cc38806446383a1497": "turcotte_lafleur_business",
    "0xa69f1ed1b56ce6c07e259799958a62c621ac9d56": "alexis_business",
    "0xDCA9d21CB9dD718c6d8CA922619eD2868Ca62f73": "alexis_personal_1",
    "0x5508c623e1eb68530bf0b95a5dc680f6d6900187": "alexis_personal_2",
} as { [key: string]: string };

const addresses_internal_owner = {
    "0x48A7f7bd80F8a8026e66e164086dc03e148bF899": "study_of_line_owner",
    "0x631fc1b7fc847976f2568c1ff712f4b7c33a9b3b": "chaos_blocks_owner",
    "0xa239c13c054e498b9be633262574862676d73f7f": "ether_ghosts_owner",
    "0xd18937f7eae8634a209c8c8032b9eb39b0b521b4": "spacebudz_owner",
    "0xEc44dBf6fe307d825717AFD7bB5e05a1FF604C41": "4096_owner",
    "0xcc1a8CC6b6662A4C4425c3DEF278afCdF234737A": "baby_alien_owner",
} as { [key: string]: string };

const addresses_internal_contract = {
    "0x0550499a6c986fd512da6c19f185538b7f2926de": "study_of_line_contract",
    "0x648ad3bbfb0578ef7b5e3bf34f028048b46b14eb": "chaos_blocks_contract",
    "0x63ad7cd8ad28102aaee0d6abd538e60c9cacc22a": "ether_ghosts_contract",
    "0x6387017dd4dda1de13d93440515765bcb2ba4564": "spacebudz_contract",
    "0x2fb6a7747f52ee559e9fe0fa8ba4608fdbf1d541": "4096_contract",
    "0xeb802bac759ed21ce96e7bbb2f9f31575a30e810": "baby_alien_contract",
} as { [key: string]: string };

const addresses_internal_other = {

    "0xc532689a88a5dbc7d5bdf4886c9a340466d3e125": "ether_ghosts_buyer_1",
    "0xb33dab527dac8abaec0c9f2cd7fe27fdb047612a": "ether_ghosts_buyer_2",
    "0x5042fee4ce5c6aed241a79d9309e1fb640ee3e19": "ether_ghosts_buyer_3",
    "0x8AFA2c45FD9614A818b7Cb242eA361B1EA073f29": "ether_ghosts_buyer_4",
    "0xa5f5ad354e6ca952357852fb7251515b077c6f75": "spacebudz_buyer_1",
    "0x32a89296599aba4febc6087ee3ea589318703ab6": "spacebudz_buyer_2",
    "0x7bb5c91edf7e66866631551c345c68aa70525eda": "spacebudz_buyer_3",
    "0x5b594af8343bfa41b67e4fa5e96ec1db6d9c18da": "spacebudz_buyer_4",
    "0x680eea5a3eb27c8bbd9beb7dc3ed12e231405aec": "spacebudz_transit_1",
} as { [key: string]: string };

const addresses_external = {
    "0xe4e7843ad88ceaf7cb4edbc244a7b0ade3b7b85b": "StefCryptoPromo",
    "0xf51c022cfdd96c75a8433343bd7825a48f307bdd": "NFTMarketer",
    "0x881d40237659c251811cec9c364ef91dc08d300c": "metamask_swap",
    "0x74de5d4fcbf63e00296fd95d33236b9794016631": "metamask_swap_2",
    "0xa18c3352be081c47abd207b0361c09b74223a1fe": "icy_tool",
    "0xe592427a0aece92de3edee1f18e0157c05861564": "uniswap",
    "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640": "uniswap_2",
    "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b": "opensea_contract",
    "0x0b7a434782792b539623fd72a428838ea4173b22": "opensea_royalty",
    "0x17376D6016c254335eA499Cb0c3EF619B2CBf584": "opensea_royalty_2",
} as { [key: string]: string };

const addresses = {} as any

Object.keys(addresses_owner).forEach(key => {
    addresses[key.toLowerCase()] = new Address(key, addresses_owner[key], "owner")
})

// make all addresses lowercase
Object.keys(addresses_internal_contract).forEach((key) => {
    addresses[key.toLowerCase()] = new Address(key, addresses_internal_contract[key], "internal", "contract");
});

Object.keys(addresses_internal_owner).forEach((key) => {
    addresses[key.toLowerCase()] = new Address(key, addresses_internal_owner[key], "internal", "owner");
});

Object.keys(addresses_internal_other).forEach((key) => {
    addresses[key.toLowerCase()] = new Address(key, addresses_internal_other[key], "internal", "other");
});

Object.keys(addresses_external).forEach((key) => {
    addresses[key.toLowerCase()] = new Address(key, addresses_external[key], "external");
});

// get address from name
function get_address_from_name(name: string) {
    for (const key in addresses) {
        if (addresses[key].name === name) {
            return addresses[key].address;
        }
    }
    return null;
}

interface EtherScanTransaction {
    tokenSymbol: string;
    tokenName: any;
    blockNumber: string;
    timeStamp: string;
    hash: string;
    nonce: string;
    blockHash: string;
    transactionIndex: string;
    from: string;
    to: string;
    value: number;
    gas: string;
    gasPrice: number;
    gasUsed: number;
    isError: string;
    txreceipt_status: string;
    category: string;
    input: string;
    contractAddress: string;
    cumulativeGasUsed: string;
    confirmations: string;
}

interface TreatedTransaction {
    token: any;
    amount: any;
    category: any;
    hash: any;
    description: string;
    blockNumber: number;
    from: string;
    to: string;
    date: string;
    value: number;
    cad_value: number;
    gasFee: number;
    gasFeeCad: number;
    profit: number;
    eth_price: number;
    eth_balance: number;
    type: string;
    average_eth_price: number;
    is_error: boolean;
}

interface Summary {
    total_eth_in: number;
    total_eth_out: number;
    total_expenses_eth: number;
    total_expenses_cad: number;
    total_profit_eth: number;
    total_profit_cad: number;
    alexis_profit_eth: number;
    alexis_profit_cad: number;
    turcotte_profit_eth: number;
    turcotte_profit_cad: number;
    lafleur_profit_eth: number;
    lafleur_profit_cad: number;
    total_gas_fee_eth: number;
    total_gas_fee_cad: number;
    total_cad_in: number;
    total_cad_out: number;
}

function sort_transactions_from_list(transactions: EtherScanTransaction[]) {

    transactions.sort((a, b) => {
        return Number(a.blockNumber) - Number(b.blockNumber);
    });

    return transactions;
}

const last_block_2021 = 13916165;
const last_block_tax_season_lafleur = 13717840;

// function that gets transactions for a specific address
async function get_transactions_for_address(address: string) {
    const normal_transactions = await get_transactions_from_etherscan(address, starting_block, last_block_tax_season_lafleur, 'txlist');
    // set category to normal
    if (normal_transactions.length > 0) {
        normal_transactions.forEach((transaction) => {
            transaction.category = 'normal';
        });
    }


    const internal_transactions = await get_transactions_from_etherscan(address, starting_block, last_block_tax_season_lafleur, 'txlistinternal');
    // set category to internal
    if (internal_transactions.length > 0) {
        internal_transactions.forEach((transaction) => {
            transaction.category = 'internal';
        });
    }

    const erc20_transactions = await get_transactions_from_etherscan(address, starting_block, last_block_tax_season_lafleur, 'tokentx');
    // set category to erc20
    if (erc20_transactions.length > 0) {
        erc20_transactions.forEach((transaction) => {
            transaction.category = 'erc20';
        });
    }

    // const erc721_transactions = await get_transactions_from_etherscan(address, starting_block, 'latest', 'tokennfttx');
    const transactions = normal_transactions.concat(internal_transactions, erc20_transactions);
    return transactions;
}

// function that does a call to the etherscan api and gets all transactions for a specific address
async function get_transactions_from_etherscan(address: string, start_block: number, end_block: number | string, action: string) {
    const url = "https://api.etherscan.io/api?module=account&action=" + action + "&address=" + address + "&startblock=" + start_block + "&endblock=" + end_block + "&page=1&offset=0&sort=asc&apikey=" + etherscan_api_key;
    const response = await fetch(url);
    const data = await response.json() as any;
    const transactions = data.result as EtherScanTransaction[];
    return transactions;
}

// function that writes transactions to a csv file
async function write_transactions_to_csv(transactions: any, summary: any, filename: string) {
    let csv = "wallet,hash,blockNumber,from,to,date,error,value,cad_value,description,amount,token,gasFee,gasFeeCad,profit,eth_price,eth_balance,average_eth_price,type,category,\n";
    csv += transactions.map((transaction: TreatedTransaction) => {
        // if (transaction.type == "out" && transaction.category == "normal") {
        return [
            current_address,
            transaction.hash,
            transaction.blockNumber,
            transaction.from,
            transaction.to,
            transaction.date,
            transaction.is_error,
            transaction.value,
            transaction.cad_value,
            transaction.description,
            transaction.amount,
            transaction.token,
            transaction.gasFee,
            transaction.gasFeeCad,
            transaction.profit,
            transaction.eth_price,
            transactions.eth_balance,
            transaction.average_eth_price,
            transaction.type,
            transaction.category,

        ].join(',');
        // } else {

        // }
    }
    ).join('\n');

    csv += "\nSUMMARY\n";
    csv += "Wallet :," + addresses[current_address].name + "\n";
    csv += ",eth,cad \n";
    // add every items from the summary object to the csv in a column for eth and one for cad
    csv += "total in, " + summary.total_eth_in + ", " + summary.total_cad_in + "\n";
    // csv += "total gas fee, " + summary.total_gas_fee_eth + ", " + summary.total_gas_fee_cad + "\n";
    // csv += "total out, " + summary.total_eth_out + ", " + summary.total_cad_out + "\n";
    csv += "total expenses, " + summary.total_expenses_eth + ", " + summary.total_expenses_cad + "\n";
    csv += "total profit, " + summary.total_profit_eth + ", " + summary.total_profit_cad + "\n";
    csv += "alexis profit, " + summary.alexis_profit_eth + ", " + summary.alexis_profit_cad + "\n";
    csv += "turcotte profit, " + summary.turcotte_profit_eth + ", " + summary.turcotte_profit_cad + "\n";
    csv += "lafleur profit, " + summary.lafleur_profit_eth + ", " + summary.lafleur_profit_cad + "\n";


    fs.writeFileSync(filename, csv);
}

function treat_special_cases(tx: EtherScanTransaction) {
    // special cases
    if (tx.hash === "0xc1b374e14cf4953ed0aa70678f396f2a1b60fac0f18f8e2d329f08dbe2314aee") {
        tx.to = "0x0d7C9DB889858b9F6954608e36199104Dd530dA0".toLowerCase();
    } else if (tx.hash === "0x850241a5fd3b6c2bc909533b9772de9dfc6d011122e79e44936d059dae489abb") {
        tx.from = "0xec44dbf6fe307d825717afd7bb5e05a1ff604c41"
    } else if (tx.hash === "0x9bca7b1e56aff01553ac82522f4e0566f8f26571897a3a2b40829d8a8a02be5b") {
        tx.to = "0xcc1a8cc6b6662a4c4425c3def278afcdf234737a"
    } else if (tx.hash === "0xff9fe31e9e8e981ca25da3a4655b96d27701824fd33b5308aadfd5e51ea329da" || tx.hash === "0x1658c21fdbf96c87436c4cc362fa8afc22755e9212286f5bee148be452d05388" || tx.hash === "0x1756509b15113c3df1c21d29e1f32dd8f9f15a0094dc3e2a238ee15c3a91a893" || tx.hash === "0xc3ba0da3d16502cf82bea03de1694363ecc6bfd2ffce46472273fab4e4ddf272") {
        // transfer to spacebudz from etherghosts
        tx.from = "0xa239c13c054e498b9be633262574862676d73f7f".toLowerCase();
    } else if (tx.hash === "0x8a8d9be0ea5a7eac257a31c069726864acf8ae7b15431ca5679e54368f371526") {
        tx.to = "0x0d7c9db889858b9f6954608e36199104dd530da0".toLowerCase();
    } else if (tx.hash === "0x37e720ed14271a5b074f3a88d81c465deb932eddadb0b07905ed043fb45315d8") {
        tx.to = "0xa69f1ed1b56ce6c07e259799958a62c621ac9d56".toLowerCase();
    } else if (tx.hash === "0xb73d7d20a06538b61712291ccea002b2dc68b5a9c2bf2390ddec5c9b47205ca7") {
        tx.to = "0x0da2f3401296427d302326cdf208b79f83abc995".toLowerCase();
    } else if (tx.hash === "0x2dd26aba16ce01b7b1cd87da0c504b7cdc954ca6b77985476c593fc51bffd2ae") {
        tx.to = "0x0d7c9db889858b9f6954608e36199104dd530da0".toLowerCase();
    } else if (tx.hash === "0xb025a8b5396599b0c46555a016efd3c54003762df2cb7e91364fa28274bbc1a6") {
        tx.to = "0xa69f1ed1b56ce6c07e259799958a62c621ac9d56".toLowerCase();
    } else if (tx.hash === "0x1c8ca0336db59441893d7eb3cac8009294b85d1a24262e45c58415614a6a4679") {
        tx.to = "0x0da2f3401296427d302326cdf208b79f83abc995".toLowerCase();
    } else if (tx.hash === "0x6cd9803684a01f95e10e28b6fe78a97737058b4e2ddfe6198ee0768514720e0e") {
        tx.to = "0x0da2f3401296427d302326cdf208b79f83abc995".toLowerCase();
    } else if (tx.hash === "0x2cd415e8315ac10a10f2489e926e58083b85f0b3bc19e024f1b6a567823318bc") {
        // virement à alexis le 2021-10-08 pour 9770 USD
        tx.to = "0xa69f1ed1b56ce6c07e259799958a62c621ac9d56".toLowerCase();
    } else if (tx.hash === "0x430299bd8b50847478bd22c0c14b135823205cbe788823173da33c2df6101da3") {
        // virement à turcotte le 2021-10-08 pour 9770 USD
        tx.to = "0x0d7c9db889858b9f6954608e36199104dd530da0".toLowerCase();
    } else if (tx.hash === "0x25de106d0339f393df949b3b5c73717393bb58b7aa3573db5f19f19e68b26fb0") {
        // virement à lafleur le 2021-10-08 pour 6090 USD
        tx.to = "0x0da2f3401296427d302326cdf208b79f83abc995".toLowerCase();
    } else if (tx.hash === "0x2ce05ca2c7ac7af6617efcfdf89af8d38e4e4a0ea369b0eca0654a452aa4952c") {
        // final cash out to lafleur
        tx.to = "0x0da2f3401296427d302326cdf208b79f83abc995"
    } else if (tx.hash === "0xeff4cb1516a5b646dcc053ff37e8575f49f6036b4f20d242543f01325b1dd97b" || tx.hash === "0x2a9643bf4cb45000dccdb9cc6e2c17d17a62cbfae70d72d6845b07b5f5f58580" || tx.hash === "0x8903ab8e6246d94c802eb05d2101fca1f37b333238eb2a740dcc3dd5c638e464" || tx.hash === "0x6b49578c5e6c4a996f78a8e3a10c7a6d002445b466e3a42260b790f1e892fbfe") {
        // transfer from etherghosts to spacebudz
        tx.to = "0xd18937f7eae8634a209c8c8032b9eb39b0b521b4"
    }
    else if (tx.hash === "0x3f6321c59f3c2aa271367ae9487f869a0e48ebed24c939c26b5db6bb1852f169" || tx.hash === "0xdc6dc74776b5dc9b3b27f5d4a20395b5461ce6188e4da43550c4bca83f79dbc9") {
        //  cash out to lafleur //TO CONFIRM
        tx.to = "0x0da2f3401296427d302326cdf208b79f83abc995"
    }
}

function create_basic_treated_tx(tx: EtherScanTransaction) {

    let treated_tx: TreatedTransaction

    if (tx.category == "normal" || tx.category == "internal") {

        treated_tx = {
            hash: tx.hash,
            blockNumber: Number(tx.blockNumber),
            from: tx.from,
            to: tx.to,
            date: tx.timeStamp,
            value: Number(tx.value) / 1000000000000000000,
            gasFee: tx.gasPrice ? Number(tx.gasUsed) * Number(tx.gasPrice) / 1000000000000000000 : 0,
            gasFeeCad: 0,
            profit: 0,
            eth_price: 0,
            type: "",
            average_eth_price: 0,
            description: "",
            token: "eth",
            amount: 0,
            cad_value: 0,
            category: tx.category,
            is_error: tx.isError == "1"

        } as TreatedTransaction;

        if (treated_tx.is_error) { treated_tx.value = 0; }

    } else if (tx.category == "erc20") {

        // console.log("erc20 tx", tx);

        treated_tx = {
            hash: tx.hash,
            value: 0,
            blockNumber: Number(tx.blockNumber),
            from: tx.from,
            to: tx.to,
            date: tx.timeStamp,
            description: "TO BE DEFINED",
            category: tx.category,
            token: tx.tokenName,
            amount: tx.tokenSymbol == "USDC" ? Number(tx.value) / 1000000 : NaN,
            is_error: tx.isError == "1"

        } as TreatedTransaction;

        if (treated_tx.is_error) { treated_tx.amount = 0; }
    }
    return treated_tx;
}

function create_summary_from_treated_transactions(treated_transactions: TreatedTransaction[], summary: Summary) {

    let expenses_cad = 0;
    let expenses_eth = 0;
    let profits_cad = 0;
    let profits_eth = 0;

    let alexis_profit_eth = 0;
    let alexis_profit_cad = 0;
    let turcotte_profit_eth = 0;
    let turcotte_profit_cad = 0;
    let lafleur_profit_eth = 0;
    let lafleur_profit_cad = 0;

    for (const address in addresses) {
        if (addresses[address].type == "external") { // REMOVED "internal"
            expenses_eth += addresses[address].eth_in - addresses[address].eth_out;
            expenses_cad += addresses[address].cad_in - addresses[address].cad_out;
        } else if (addresses[address].type == "internal") {
            if (addresses[address].subtype == "contract") {
                expenses_eth += addresses[address].eth_in;
                expenses_cad += addresses[address].cad_in;
                // profits_eth -= addresses[address].eth_out;
                // profits_cad -= addresses[address].cad_out;
            } else {
                expenses_eth += addresses[address].eth_in // - addresses[address].eth_out;
                expenses_cad += addresses[address].cad_in // - addresses[address].cad_out;
            }

        }
        else if (addresses[address].type == "owner") {

            profits_eth += addresses[address].eth_in - addresses[address].eth_out;
            profits_cad += addresses[address].cad_in - addresses[address].cad_out;

            if (addresses[address].name == "alexis_business" || addresses[address].name == "alexis_personal_1" || addresses[address].name == "alexis_personal_2") {
                alexis_profit_eth += addresses[address].eth_in - addresses[address].eth_out;
                alexis_profit_cad += addresses[address].cad_in - addresses[address].cad_out;
            }
            else if (addresses[address].name == "turcotte_business" || addresses[address].name == "turcotte_personal_1" || addresses[address].name == "turcotte_personal_2") {
                turcotte_profit_eth += addresses[address].eth_in - addresses[address].eth_out;
                turcotte_profit_cad += addresses[address].cad_in - addresses[address].cad_out;
            }
            else if (addresses[address].name == "lafleur_business") {
                lafleur_profit_eth += addresses[address].eth_in - addresses[address].eth_out;
                lafleur_profit_cad += addresses[address].cad_in - addresses[address].cad_out;
            }
            else if (addresses[address].name == "turcotte_lafleur_business") {
                turcotte_profit_eth += addresses[address].eth_in / 2 - addresses[address].eth_out / 2;
                turcotte_profit_cad += addresses[address].cad_in / 2 - addresses[address].cad_out / 2;
                lafleur_profit_eth += addresses[address].eth_in / 2 - addresses[address].eth_out / 2;
                lafleur_profit_cad += addresses[address].cad_in / 2 - addresses[address].cad_out / 2;
            }

        }
    }

    // console.log(addresses)

    console.log("expenses:" + expenses_cad + " " + expenses_eth);
    console.log("profits:" + profits_cad + " " + profits_eth);
    console.log("total:", expenses_cad + profits_cad, expenses_eth + profits_eth);
    console.log("gas fees cad....:", summary.total_gas_fee_cad);

    const total_cad_out = expenses_cad + profits_cad;

    summary.total_expenses_cad = expenses_cad + summary.total_gas_fee_cad
    summary.total_expenses_eth = expenses_eth + summary.total_gas_fee_eth
    summary.total_profit_eth = profits_eth
    summary.total_profit_cad += profits_cad
    summary.alexis_profit_eth = alexis_profit_eth
    summary.alexis_profit_cad = alexis_profit_cad
    summary.turcotte_profit_eth = turcotte_profit_eth
    summary.turcotte_profit_cad = turcotte_profit_cad
    summary.lafleur_profit_eth = lafleur_profit_eth
    summary.lafleur_profit_cad = lafleur_profit_cad
    summary.total_cad_out = total_cad_out

    console.log(summary);


    return summary;
}

// function that treats transactions
async function treat_transactions(transactions: EtherScanTransaction[]) {

    const eth_prices = historical_eth_prices();
    const usd_prices = historical_usd_prices();

    let eth_balance = 0;
    let total_gas_fee_eth = 0;
    let total_eth_in = 0;
    let total_cad_in = 0;
    let total_eth_out = 0;
    let total_gas_fee_cad = 0;
    let total_profit_cad = 0;

    let average_eth_price = 0;

    const treated_transactions: TreatedTransaction[] = [];
    for (const tx of transactions) {

        treat_special_cases(tx);

        const treated_tx = create_basic_treated_tx(tx);

        // transform hex timestamp to date
        const dateInt = Number(tx.timeStamp);
        const date = new Date(dateInt * 1000);
        // keep only year, month, day form date
        const date_string = date.toISOString().slice(0, 10);

        treated_tx.date = date_string;
        // console.log("date:", date_string);

        const eth_price = eth_prices.get(date_string);
        const usd_price = usd_prices.get(date_string);
        // console.log("eth_price:", eth_price);
        treated_tx.eth_price = eth_price;
        // treated_tx.et

        if (tx.from == current_address) {
            if (tx.category == "normal") {
                const gasFee = tx.gasUsed * tx.gasPrice / 1000000000000000000;

                total_gas_fee_eth += gasFee;
                total_gas_fee_cad += gasFee * eth_price;
                eth_balance -= gasFee
                treated_tx.gasFeeCad = treated_tx.gasFee * eth_price;
            }

            if (Math.abs(treated_tx.value) > 0 || treated_tx.amount > 0) {
                try {
                    treated_tx.description = "transfer to " + addresses[tx.to].name;
                    addresses[tx.to].eth_in += treated_tx.value;
                } catch (e) {
                    console.log("name not found for address:", tx.to);
                }
            }

            total_eth_out += treated_tx.value;
            treated_tx.value = treated_tx.value * -1;

            treated_tx.type = "out";

            treated_tx.profit = (eth_price - average_eth_price) * (treated_tx.value);
            total_profit_cad += treated_tx.profit;
            // if (treated_tx.token == "eth" || treated_tx.token == "WETH") {
            //     treated_tx.eth_diff += treated_tx.value;
            // }
        }
        else {
            treated_tx.gasFee = 0;
            treated_tx.gasFeeCad = 0;

            if (tx.to == current_address) {
                if (addresses[tx.from]) {
                    treated_tx.description = "transfer from " + addresses[tx.from].name;

                    if (addresses[tx.from].type == "internal" || addresses[tx.from].type == "owner") {

                        treated_tx.type = "internal";
                        addresses[tx.from].eth_out += treated_tx.value;
                        addresses[tx.from].cad_out += Math.abs(treated_tx.value * eth_price);
                    }
                } else {
                    if (addresses[current_address].subtype == "owner" || addresses[current_address].subtype == "other") {
                        treated_tx.description = "transfer from UNKNOWN";
                        console.log("unknown address:", tx.from);
                    }
                }
                total_eth_in += treated_tx.value;
                if (treated_tx.token == "eth" || treated_tx.token == "WETH") {
                    total_cad_in += treated_tx.value * eth_price;
                }
                else if (treated_tx.token == "USDC") {
                    total_cad_in += treated_tx.amount * usd_price;
                }
                treated_tx.type = "in";
                average_eth_price = (average_eth_price * eth_balance + treated_tx.value * eth_price) / (eth_balance + treated_tx.value + 1e-10);
            }
        }

        if (tx.category == "normal" || tx.category == "internal") {
            treated_tx.cad_value = treated_tx.value * eth_price;
            eth_balance += treated_tx.value;
            treated_tx.average_eth_price = average_eth_price;
        } else if (tx.category == "erc20" && tx.tokenSymbol == "USDC") {
            if (treated_tx.type == "out") {
                treated_tx.amount = -treated_tx.amount;
            }
            treated_tx.cad_value = treated_tx.amount * usd_price;
        }

        if (treated_tx.type == "in") {
            if (addresses[tx.from]) {
                addresses[tx.from].cad_out += Math.abs(treated_tx.cad_value);
            }
        }
        else if (treated_tx.type == "out") {
            if (addresses[tx.to]) {
                addresses[tx.to].cad_in += Math.abs(treated_tx.cad_value);
            }
        }

        treated_transactions.push(treated_tx);
    }

    // console.log(addresses[get_address_from_name("alexis_business")]);
    // console.log(addresses);


    // console.log("remaining balance", eth_balance);
    // console.log("profits_cad", total_profit);
    // console.log("total_gas_fee", total_gas_fee_eth);
    // console.log("total_eth_in", total_eth_in);
    // console.log("total_eth_out", total_eth_out);
    // console.log("balance", total_gas_fee_eth + total_eth_out + eth_balance);

    const summary = {
        total_eth_in,
        total_eth_out,
        total_gas_fee_eth,
        total_gas_fee_cad,
        total_profit_eth: 0,
        total_profit_cad,
        total_cad_in,
        total_cad_out: 0,
        total_expenses_eth: 0,
        total_expenses_cad: 0,
        alexis_profit_eth: 0,
        alexis_profit_cad: 0,
        turcotte_profit_eth: 0,
        turcotte_profit_cad: 0,
        lafleur_profit_eth: 0,
        lafleur_profit_cad: 0,
    } as Summary;

    create_summary_from_treated_transactions(treated_transactions, summary);

    return [treated_transactions, summary];
}


let current_address = ""

async function generate_for_address(address: string) {
    current_address = address.toLowerCase();
    console.log("current_address", current_address);
    const transactions = await get_transactions_for_address(current_address);
    const sorted_transactions = sort_transactions_from_list(transactions);
    const [treated_transactions, summary] = await treat_transactions(sorted_transactions);
    // console.log("treated_transactions", treated_transactions);
    // console.log("summary", summary);
    write_transactions_to_csv(treated_transactions, summary, './out/transactions_' + addresses[current_address].name + '.csv');
    return [treated_transactions, summary] as [TreatedTransaction[], Summary];
}

async function generate_for_all_addresses() {
    const all_transactions = [];
    const global_summary = {
        total_eth_in: 0,
        total_eth_out: 0,
        total_gas_fee_eth: 0,
        total_gas_fee_cad: 0,
        total_expenses_cad: 0,
        total_expenses_eth: 0,
        total_profit_eth: 0,
        total_profit_cad: 0,
        alexis_profit_eth: 0,
        alexis_profit_cad: 0,
        turcotte_profit_eth: 0,
        turcotte_profit_cad: 0,
        lafleur_profit_eth: 0,
        lafleur_profit_cad: 0,
        total_cad_in: 0,
        total_cad_out: 0,
    } as Summary;

    for (const address in addresses) {

        for (const address_l2 in addresses) {
            addresses[address_l2].eth_in = 0;
            addresses[address_l2].eth_out = 0;
            addresses[address_l2].cad_in = 0;
            addresses[address_l2].cad_out = 0;
        }

        if (addresses[address].type == "internal") {
            const add_curr = address
            console.log("\n \n")
            const [treated_transactions_temp, summary_temp] = await generate_for_address(add_curr);
            all_transactions.push(...treated_transactions_temp);

            global_summary.total_eth_in += summary_temp.total_eth_in;
            global_summary.total_eth_out += summary_temp.total_eth_out;
            global_summary.total_gas_fee_eth += summary_temp.total_gas_fee_eth;
            global_summary.total_gas_fee_cad += summary_temp.total_gas_fee_cad;
            global_summary.total_expenses_cad += summary_temp.total_expenses_cad;
            global_summary.total_expenses_eth += summary_temp.total_expenses_eth;
            global_summary.total_profit_eth += summary_temp.total_profit_eth;
            global_summary.total_profit_cad += summary_temp.total_profit_cad;
            global_summary.alexis_profit_eth += summary_temp.alexis_profit_eth;
            global_summary.alexis_profit_cad += summary_temp.alexis_profit_cad;
            global_summary.turcotte_profit_eth += summary_temp.turcotte_profit_eth;
            global_summary.turcotte_profit_cad += summary_temp.turcotte_profit_cad;
            global_summary.lafleur_profit_eth += summary_temp.lafleur_profit_eth;
            global_summary.lafleur_profit_cad += summary_temp.lafleur_profit_cad;
            global_summary.total_cad_in += summary_temp.total_cad_in;
            global_summary.total_cad_out += summary_temp.total_cad_out;
        }

        // wait 2 seconds between each address
        await sleep(2000);
    }

    // console.log("global_summary", global_summary);
    write_transactions_to_csv(all_transactions, global_summary, './out/transactions_all.csv');
}

export async function main_helixir() {

    generate_for_address("0xd18937f7eae8634a209c8c8032b9eb39b0b521b4")
    // await generate_for_all_addresses();

}

function sleep(millis: number) {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, millis);
    });
}
