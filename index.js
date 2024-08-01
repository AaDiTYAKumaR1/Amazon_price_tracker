const express = require('express');
const puppeteer = require('puppeteer');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const app = express();
const port = 3000;
const adapter = new FileSync('data/prices.json');
const db = low(adapter);

// Set some defaults
db.defaults({ prices: [] }).write();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

async function getAmazonPrices(url) {
    // Launch Puppeteer
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Open the Amazon product page
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Extract the prices
    let prices = { mainPrice: null, dealPrice: null };
    try {
        await page.waitForSelector('.a-price-whole,.a-text-price', { timeout: 10000 });
        prices = await page.evaluate(() => {
            const mainPriceElement = document.querySelector('.a-price-whole');
            const dealPriceElement = document.querySelector('.a-text-price');

            const mainPrice = mainPriceElement ? mainPriceElement.innerText.replace(/[^\d,.]/g, '') : null;
            const dealPrice = dealPriceElement ? dealPriceElement.innerText.replace(/[^\d,.]/g, '') : null;

            return {
                mainPrice,
                dealPrice
            };
        });
    } catch (e) {
        console.log("Prices not found. The product may not be available or the page structure may have changed.");
    }

    await browser.close();
    console.log(prices)
    return prices;
}

// (async () => {
//     const url = "https://www.amazon.in/Apple-iPhone-15-128-GB/dp/B0CHX2F5QT"; // Replace with the actual product URL
//     const prices = await getAmazonPrices(url);
//     if (prices.mainPrice || prices.dealPrice) {
//         console.log(`The current main price of the product is ${prices.mainPrice}`);
//         console.log(`The current deal price of the product is ${prices.dealPrice}`);
//     } else {
//         console.log("Failed to retrieve the prices.");
//     }
// })();
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/track', async (req, res) => {
    const url = req.body.url;
    const prices = await getAmazonPrices(url);

    if (prices.mainPrice || prices.dealPrice) {
        db.get('prices')
          .push({ url, date: new Date().toISOString(), mainPrice: prices.mainPrice, dealPrice: prices.dealPrice })
          .write();
    }

    res.render('result', { url, prices });
});

app.get('/chart', (req, res) => {
    const priceData = db.get('prices').value();
    res.render('chart', { priceData });
});
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
