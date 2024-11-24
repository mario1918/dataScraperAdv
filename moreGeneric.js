
const express = require('express');
const { chromium } = require('playwright');
const cheerio = require('cheerio');
const fs = require('fs');

const app = express();
const PORT = 4000;

app.use(express.json());

app.post('/fetch-specs', async (req, res) => {
    //const { specs } = req.body;
    let config;
    // Read from the configuration file
    try {
        const configFile = fs.readFileSync('config.json');
        config = JSON.parse(configFile);

    }catch (err) {
        console.error('Error in reading config file', err);
        return res.status(500).send('Failed to read the config file');
    }

    const {url, specs} = config;

    if ( !url || !specs || !Array.isArray(specs)) {
        return res.status(400).send('Invalid configuration: URL and specifications must be provided');
    }

    try {
        const browser = await chromium.launch({ headless: false });
        const page = await browser.newPage();
        page.setDefaultTimeout(300000);

        //page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

        try {
            console.log('Browser opened. Navigating to the page ...');
            await page.goto(url);
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
