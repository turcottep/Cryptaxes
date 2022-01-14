import fs from 'fs';

// function that reads price data from a csv file
function read_price_csv(filename: string) {
    const data = fs.readFileSync(filename);
    const csv_data = data.toString();
    const lines = csv_data.split('\n');

    // map of date to price
    const price_data = new Map<string, number>();

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        // split line by pair of quotes
        const split_line = line.split(/"([^"]+)"/);
        // const split_line = line.split('","');

        // const line_data = line.split('"');
        const date = split_line[1];
        const price_string = split_line[3].replace(',', '')
        const price = Number(price_string);
        // transform "Apr 01, 2021" date to "2021-04-01"
        const date_obj = new Date(date);
        // keep only year, month, day form date
        const date_string = date_obj.toISOString().slice(0, 10);

        price_data.set(date_string, price);
    }
    // console.log(price_data);

    return price_data;
}

function historical_eth_prices() {
    return read_price_csv('eth-cad_price.csv');
}

function historical_usd_prices() {
    return read_price_csv('usd-cad_price.csv');
}

export { historical_eth_prices, historical_usd_prices };