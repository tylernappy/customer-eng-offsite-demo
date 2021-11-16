require('dotenv').config();

const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.json());

const path = require('path');
const util = require('util');

const PORT = process.env.PORT || 3000;

let ACCESS_TOKEN, ACCOUNT_ID, AUTHORIZATION_ID;

const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const configuration = new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': process.env.CLIENT_ID,
            'PLAID-SECRET': process.env.SECRET,
        },
    },
});
const plaidClient = new PlaidApi(configuration);

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/create-link-token', async (req, res) => {
    const response = await plaidClient.linkTokenCreate({
        user: {
            client_user_id: 'some-unique-identifier',
        },
        client_name: 'App of Tyler',
        products: ['transfer'],
        country_codes: ['US'],
        language: 'en',
    });
    const { link_token: linkToken } = response.data;
    res.json({ linkToken });
});

app.post('/token-exchange', async (req, res) => {
    try {
        const { publicToken } = req.body;
        ({ accountId: ACCOUNT_ID } = req.body);

        const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
        ({ access_token: ACCESS_TOKEN } = response.data);

        res.json({ accessToken: ACCESS_TOKEN });
    } catch(error) {
        console.log(error);
    }
});

app.post('/authorize-transfer', async (req, res) => {
    try {
        const { amount } = req.body;

        const response = await plaidClient.transferAuthorizationCreate({
            access_token: ACCESS_TOKEN,
            account_id: ACCOUNT_ID,
            type: 'credit',
            network: 'ach',
            amount,
            ach_class: 'ppd',
            user: {
                legal_name: 'Tony Stark',
                email_address: 'tony@starkinc.com',
                address: {
                    street: '123 Main St.',
                    city: 'San Francisco',
                    region: 'CA',
                    postal_code: '94053',
                    country: 'US'
                },
            },
        });

        ({ id: AUTHORIZATION_ID } = response.data.authorization);
        const { decision, decision_rationale: decisionRationale } = response.data.authorization;

        res.json({ authorizationId: AUTHORIZATION_ID, decision, decisionRationale });
    } catch (error) {
        console.log(error);
    }
});

app.post('/create-transfer', async (req, res) => {
    const { amount } = req.body;
    
    try {
        const response = await plaidClient.transferCreate({
            idempotency_key: '1223abc456xyz7890001',
            access_token: ACCESS_TOKEN,
            account_id: ACCOUNT_ID,
            authorization_id: AUTHORIZATION_ID,
            type: 'credit',
            network: 'ach',
            amount,
            description: 'Payment',
            ach_class: 'ppd',
            user: {
                legal_name: 'Tony Stark',
                email_address: 'tony@starkinc.com',
                address: {
                    street: '123 Main St.',
                    city: 'San Francisco',
                    region: 'CA',
                    postal_code: '94053',
                    country: 'US'
                }
            },
        });

        const { id: transferId } = response.data.transfer;
        res.json({ transferId });
    } catch (error) {
        console.log(error);
    }
});

app.listen(PORT, () => {
    console.log('Listening on port', PORT);
});