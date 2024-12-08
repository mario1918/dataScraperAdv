
const express = require('express');
const { chromium } = require('playwright');
const cheerio = require('cheerio');
const fs = require('fs');

const app = express();
const PORT = 4000;

app.use(express.json());

app.post('/fetch-specs', async (req, res) => {
    let config;

    // Read from the configuration file

    try {
        const configFile = fs.readFileSync('config.json');
        config = JSON.parse(configFile);
    } catch (err) {
        console.error('Error in reading config file:', err);
        return res.status(500).send('Failed to read the config file');
    }

    const { url, specs } = config;

    if (!url || !specs || !Array.isArray(specs)) {
        return res.status(400).send('Invalid configuration: URL and specifications must be provided');
    }

    try {
        const browser = await chromium.launch({ headless: false });
        const page = await browser.newPage();
        page.setDefaultTimeout(300000);

        try {
            await page.goto(url);
            console.log('Navigated to the page');
        } catch (err) {
            console.error('Error during navigation:', err);
            res.status(500).send('Failed to navigate to the page');
            await browser.close();
            return;
        }

        await page.waitForTimeout(5000)

        // TODO: enhance--------------------------------------------------------------------
        // Inject a script to serialize the DOM including shadow roots
        await page.evaluate(() => {
            function serializeNode(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    return node.textContent;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const obj = {
                        tagName: node.tagName.toLowerCase(),
                        attributes: {},
                        children: []
                    };

                    // Extract attributes
                    for (let i = 0; i < node.attributes.length; i++) {
                        const attr = node.attributes[i];
                        obj.attributes[attr.name] = attr.value;
                    }

                    // If element has a shadow root, serialize its children
                    if (node.shadowRoot) {
                        obj.shadowRoot = Array.from(node.shadowRoot.childNodes).map(serializeNode);
                    }

                    // Serialize child nodes
                    for (const child of node.childNodes) {
                        obj.children.push(serializeNode(child));
                    }
                    return obj;
                } else if (node.nodeType === Node.COMMENT_NODE) {
                    return `<!--${node.nodeValue}-->`;
                }
                return null;
            }

            window.__serializedDom__ = serializeNode(document.documentElement);
        });

        const serializedDomJSON = await page.evaluate(() => JSON.stringify(window.__serializedDom__));
        await browser.close();

        const domObject = JSON.parse(serializedDomJSON);

        function buildHTML(obj) {
            if (typeof obj === 'string') {
                // Text node content
                return obj;
            }
            if (!obj || !obj.tagName) {
                return '';
            }

            // Build attributes string
            const attrs = Object.entries(obj.attributes || {})
                .map(([key, val]) => `${key}="${val}"`)
                .join(' ');
            const attrString = attrs ? ' ' + attrs : '';

            // Build shadow root content if present
            let shadowContent = '';
            if (obj.shadowRoot) {
                // Represent shadow root content in a comment block or a custom container
                // Here we use comment markers to encapsulate shadow DOM content
                const shadowHTML = obj.shadowRoot.map(buildHTML).join('');
                shadowContent = `<!-- shadow-root-start -->${shadowHTML}<!-- shadow-root-end -->`;
            }

            // Build children
            const childrenHTML = (obj.children || []).map(buildHTML).join('');

            return `<${obj.tagName}${attrString}>${shadowContent}${childrenHTML}</${obj.tagName}>`;
        }

        const finalHTML = buildHTML(domObject);
        fs.writeFileSync('pageContent.html', finalHTML)
        // -----------------------------------------------------------------------------------

        const $ = cheerio.load(finalHTML);

        let response = {};

        const findSpecificationValues = (spec) => {
            const specLower = spec.toLowerCase();
            console.log(`specLower: ${specLower}`);
            let foundValues = null;
            console.log(`..Before..`);
            const specElement = $(`body *:contains("${spec}")`)
                .filter(function () {
                    return $(this).text().trim().toLowerCase() === specLower;
                });

            console.log(`Found specification elements: ${specElement}`);

            if (specElement.length > 0) {
                const parent = specElement.parent();
                console.log(`The parent: ${parent.html()}`);

                foundValues = parent.contents().not(specElement)
                    .map((i, sibling) => $(sibling).text().trim())
                    .get()
                    .filter(text => text && !text.includes(spec));

                console.log(`the foundValues: ${foundValues}`);

                if (foundValues.length === 0) {
                    foundValues = specElement.nextAll()
                        .map((i, sibling) => $(sibling).text().trim())
                        .get()
                        .filter(text => text && !text.includes(spec));
                }
            } else {
                console.error('((No specification elements found))');
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

        console.log('END');

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
