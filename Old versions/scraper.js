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
        const productSeries = $('div.col-sm-12.col-md-6 h4').text().trim();
        let productDescription;
        let productPrice;

        if(productSeries.length > 0) {
            productDescription =  $('div.col-sm-12.col-md-6 h5:nth-child(3)').text().trim();
            productPrice =  $('div.col-sm-12.col-md-6 h5:nth-child(4)').text().trim();
        }else {
            productDescription =  $('div.col-sm-12.col-md-6 h5:nth-child(2)').text().trim();
            productPrice =  $('div.col-sm-12.col-md-6 h5:nth-child(3)').text().trim();
        }

        const productOverview = $('div#product-overview p').text().trim();
        

        let whereToBuy = [];
        
        $('#app div:nth-of-type(2) div:nth-of-type(1) div:nth-of-type(3) div:nth-of-type(2) div:nth-of-type(2) table tbody tr').each((i,tr) => {
            
            
            const distributorCell = $(tr).find('td:nth-child(2)').text().trim();
            const quantityCell = $(tr).find('td:nth-child(3)').text().trim();
            const lastUpdatedCell = $(tr).find('td:nth-child(4)').text().trim();

            whereToBuy.push({
                distributor: distributorCell,
                quantity: quantityCell,
                lastUpdate: lastUpdatedCell
            })
        });

        let specs = [];
        let valueCells = []

        // Traverse the table rows
        $('#product-specifications div table tbody tr').each((i, tr) => {
            const attributeCell = $(tr).find('td:nth-child(1)').text().trim();
            valueCells = [];
            $(tr).find('td:not(:first-of-type)').each((j, td) => {
                valueCells.push($(td).text().trim());
            });
            

            specs.push({
                attribute: attributeCell,
                values: valueCells
            });
        });

        await browser.close();

        res.json({
            title: productTitle,
            series: productSeries,
            description: productDescription,
            overview: productOverview,
            price: productPrice,
            whereToBuy,
            specs,
        });
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
