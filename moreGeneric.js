
const express = require('express');
const { chromium } = require('playwright');
const cheerio = require('cheerio');

const app = express();
const PORT = 4000;

app.use(express.json());

app.post('/fetch-specs', async (req, res) => {
    const { specs } = req.body;

    if (!specs || !Array.isArray(specs)) {
        return res.status(400).send('Specifications must be provided as an array');
    }

    try {
        const browser = await chromium.launch({ headless: false });
        const page = await browser.newPage();
        page.setDefaultTimeout(300000);

        //page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

        try {
            console.log('Browser opened. Navigating to the page ...');
            //await page.goto('https://www.alldatasheet.com/view.jsp?Searchword=ATMEGA128');
            //await page.goto('https://www.caltestelectronics.com/product/CT2944-93');
            //await page.goto('https://www.belden.com/products/connectors/fiber-connectors/fusion-splice-on-connectors#sort=%40catalogitemwebdisplaypriority%20ascending&numberOfResults=25');
            //await page.goto('https://www.digikey.com/en/products/detail/w%C3%BCrth-elektronik/875105359001/5147580');
            //await page.goto('https://eu.mouser.com/ProductDetail/ROHM-Semiconductor/RSX301L-30DDTE25?qs=sGAEpiMZZMtbRapU8LlZD%252B6h%2FWulpAkr%2FY1xa87RQph8xMmqFKqxyQ%3D%3D');
            //await page.goto('https://www.avnet.com/shop/us/products/diodes-incorporated/tlv271cw5-7-3074457345624875681/');
            //await page.goto('https://www.futureelectronics.com/p/semiconductors--microcontrollers--32-bit/mcxn947vdft-nxp-4182377');
            //await page.goto('https://www.tti.com/content/ttiinc/en/apps/part-detail.html?partsNumber=B151-7184-L&mfgShortname=COT&productId=1230302271');
            //await page.goto('https://export.farnell.com/roxburgh/xe12001/cap-rc-network-0-01uf-120r-250vac/dp/2336098');
            await page.goto('https://www.newark.com/hirose-hrs/bm28b0-6-50dp-2-0-35v-53/conn-stacking-header-50s-2p-2row/dp/92AH8029');


            console.log('Navigated to the page');
            //await page.waitForSelector('h1');
            //console.log('Waited for h1 to be visible');
        } catch (err) {
            console.error('Error during navigation:', err);
            res.status(500).send('Failed to navigate to the page');
            await browser.close();
            return;
        }

        const content = await page.content();
        const $ = cheerio.load(content);

        let response = {};

        const findSpecificationValues = (spec) => {
            const specLower = spec.toLowerCase();
            let foundValues = null;

            const specElement = $(`body *:contains(${spec})`).filter(function () {
                return $(this).text().trim().toLowerCase() === specLower;
            });

            if (specElement.length > 0) {
                const parent = specElement.parent();

                foundValues = parent.contents().not(specElement)
                    .map((i, sibling) => $(sibling).text().trim())
                    .get()
                    .filter(text => text && !text.includes(spec));

                if (foundValues.length === 0) {
                    foundValues = specElement.nextAll()
                        .map((i, sibling) => $(sibling).text().trim())
                        .get()
                        .filter(text => text && !text.includes(spec));
                }
            }

            return foundValues;
        };

        specs.forEach((spec) => {
            const specValues = findSpecificationValues(spec);
            if (specValues && specValues.length > 0) {
                response[spec] = specValues;
            } else {
                response[spec] = 'Specification not found';
            }
        });

        await browser.close();

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching the specifications');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
