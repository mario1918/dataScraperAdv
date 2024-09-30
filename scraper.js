const express = require('express');
const { chromium } = require('playwright');
const cheerio = require('cheerio');

const app = express();
const PORT = 4000;

app.get('/scrape-product', async (req, res) => {
    try {
        
        const browser = await chromium.launch();
        const page = await browser.newPage();
        const partnumber = req.query.partnumber;
        await page.goto(`https://www.caltestelectronics.com/product/${partnumber}`, { timeout: 300000 });
        page.setDefaultTimeout(300000);

        // Wait for the content to load by waiting for an element that appears after the spinner
        await page.waitForSelector('h1');

        // Get the HTML content after the page has fully loaded
        const html = await page.content();

        // Use Cheerio to parse the HTML
        const $ = cheerio.load(html);
        const productTitle = $('h1').text().trim();
        const productOverview = $('div#product-overview p').text().trim();

        let specs = [];

        // Traverse the table rows
        $('#product-specifications div table tbody tr').each((i, tr) => {
            const attributeCell = $(tr).find('td:nth-child(1)').text().trim();
            const valueCell = $(tr).find('td:not(:first-of-type)').text().trim();

            specs.push({
                attribute: attributeCell,
                values: [valueCell]
            });
        });

        await browser.close();

        res.json({
            title: productTitle,
            overview: productOverview,
            specs,
            firstValueAttribute: specs[0]?.values
        });
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
