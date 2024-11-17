
const express = require('express');
const { chromium } = require('playwright');
const cheerio = require('cheerio');

const app = express();
const PORT = 4000;

app.use(express.json());

app.post('/fetch-specs', async (req, res) => {
    const { specs } = req.body; // Get the specifications array from the request body


    if (!specs || !Array.isArray(specs)) {
        return res.status(400).send('Specifications must be provided as an array');
    }

    try {

        const browser = await chromium.launch();
        const page = await browser.newPage();
        console.log(`Browser opened. Navigatin to the page ...`);
        await page.goto('https://www.caltestelectronics.com/product/CT2944-93');
        await page.goto('https://www.belden.com/products/connectors/fiber-connectors/fusion-splice-on-connectors#sort=%40catalogitemwebdisplaypriority%20ascending&numberOfResults=25');
        page.setDefaultTimeout(300000);
        console.log(`Navigated to the page`);
        // Wait for the content to load by waiting for an element that appears after the spinner
        //await page.waitForSelector('h1');

        const content = await page.content();

        // Use Cheerio to parse the page content

        const $ = cheerio.load(content);
        console.log(`Loaded content on Cheerio`);

        let response = {};

        // Iterate over each specification in the provided list

        specs.forEach((spec) => {
            let found = false;
            let specKey = '';
            let specValues = [];
            $('table tr').each((index, element) => {
                const cells = $(element).find('td');

                // Get the first 'td' element as the specification key

                const keyCell = cells.first().text().trim();

                if (keyCell.toLowerCase().includes(spec.toLowerCase())) {
                    // Set the found flag and store the specification key

                    found = true;
                    specKey = keyCell;
                    console.log(`Found the cell (specification)`);

                    // Collect the values from the subsequent cells

                    cells.slice(1).each((subCellIndex, subCell) => {
                        const valueCell = $(subCell).text().trim();
                        console.log(`Getting the other value cells`);
                        if (valueCell) {
                            specValues.push(valueCell);
                            console.log(`Pushed the values into the array`);
                        }
                    });

                    return false; // Break the loop

                }
            });

            if (found) {
                response[specKey] = specValues;
            } else {
                response[spec] = 'Specification not found';
            }
        });

        await browser.close();
        console.log('DONE!');

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching the specifications');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
