const ArgumentParser = require('argparse').ArgumentParser;
const bodyParser = require('body-parser');
const express = require('express');
const iap = require('in-app-purchase');
const request = require('request');
const util = require('util');

const SUCCESS = 0;
const FAILURE = 1;

/** Parses arguments from command line. */
function parseArguments() {
    const parser = new ArgumentParser();
    parser.addArgument(['-p', '--port'], {
        nargs: 1,
        required: true,
        type: Number,
    });
    parser.addArgument(['-d', '--debug'], {
        action: 'storeTrue',
        defaultValue: false,
        required: false,
    });
    const args = parser.parseArgs();
    console.dir(args);
    return {
        port: args.port[0],
        debug: !!args.debug,
    }
}

const {
    port: PORT,
    debug: DEBUG,
} = parseArguments();

/** Gets the Google IAP validation URL. */
function getValidationUrl(receipt, token) {
    const PRODUCT_VAL = 'https://www.googleapis.com/androidpublisher/v3/applications/%s/purchases/products/%s/tokens/%s?access_token=%s';
    const SUBSCR_VAL = 'https://www.googleapis.com/androidpublisher/v3/applications/%s/purchases/subscriptions/%s/tokens/%s?access_token=%s';
    let url = '';
    switch (receipt.subscription) {
        case true:
            url = SUBSCR_VAL;
            break;
        case false:
        default:
            url = PRODUCT_VAL;
            break;
    }
    return util.format(
        url,
        encodeURIComponent(receipt.packageName),
        encodeURIComponent(receipt.productId),
        encodeURIComponent(receipt.purchaseToken),
        encodeURIComponent(token)
    );
}

function handlePromisedFunctionCb(resolve, reject) {
    return function _handlePromisedCallback(error, response) {
        if (error) {
            const errorData = {
                error: error,
                status: null,
                message: null
            };
            if (response !== null && typeof response === 'object') {
                errorData.status = response.status;
                errorData.message = response.message;
            }
            return reject(JSON.stringify(errorData), response);
        }
        return resolve(response);
    };
}

function validatePurchase(receipt, token, cb) {
    const url = getValidationUrl(receipt, token);
    const params = {
        method: 'GET',
        url: url,
        json: true
    };
    request(params, function (error, res, body) {
        if (error) {
            return cb(error, {
                status: FAILURE,
                message: body
            });
        }
        if (res.statusCode === 410) {
            // https://stackoverflow.com/questions/45688494/google-android-publisher-api-responds-with-410-purchasetokennolongervalid-erro
            return cb(new Error('ReceiptNoLongerValid'), {
                status: FAILURE,
                message: body
            });
        }
        if (res.statusCode > 399) {
            let msg;
            try {
                msg = JSON.stringify(body, null, 2);
            } catch (e) {
                msg = body;
            }
            return cb(new Error('Status:' + res.statusCode + ' - ' + msg), {
                status: FAILURE,
                message: body
            });
        }
        // we need service
        const resp = {
            service: iap.GOOGLE,
            status: SUCCESS,
            packageName: receipt.packageName,
            productId: receipt.productId,
            purchaseToken: receipt.purchaseToken
        };
        for (const name in body) {
            resp[name] = body[name];
        }
        cb(null, resp);
    });
}

async function validateGoogle(receipt, token) {
    return new Promise(function (resolve, reject) {
        validatePurchase(receipt, token, handlePromisedFunctionCb(resolve, reject));
    });
}

iap.config({});
iap.setup().then(() => {
    console.log(`Setup server successfully.`);
}).catch(error => {
    console.log(`Error setting up: ${error}`);
});

const app = express();
app.use(bodyParser.json({
    limit: 1024 * 1024 * 50 // 50MB.
}));
app.get('/check', (request, response) => {
    response.sendStatus(200);
});
app.post('/android', async (request, response) => {
    const body = request.body;
    const purchaseToken = body.purchaseToken;
    const packageName = body.packageName;
    const productId = body.productId;
    const accessToken = body.accessToken;
    DEBUG && console.log(`Receive Android request: token = ${purchaseToken} package = ${packageName} ID = ${productId}`);
    try {
        const res = await validateGoogle({
            purchaseToken,
            packageName,
            productId,
        }, accessToken);
        if (iap.isValidated(res)) {
            response.send({
                verified: true,
            });
        } else {
            response.send({
                verified: false,
            });
        }
    } catch (ex) {
        response.send({
            verified: false,
        });
    }
});
app.post('/ios', async (request, response) => {
    const body = request.body;
    const receiptData = body.receipt_base64;
    const productId = body.productId; // Unused.
    DEBUG && console.log(`Receive Android request: data = ${receiptData} ID = ${productId}`);
    try {
        const res = await iap.validate(receiptData);
        if (iap.isValidated(res)) {
            response.send({
                verified: true,
            });
        } else {
            response.send({
                verified: false,
            });
        }
    } catch (ex) {
        response.send({
            verified: false,
        });
    };
});

const server = app.listen(PORT, function () {
    const host = server.address().address;
    const port = server.address().port;
    console.log(`Server-side verification in-app purchases server listener at http://${host}:${port}`);
});