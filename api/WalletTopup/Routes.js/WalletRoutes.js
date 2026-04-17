const express = require('express');
const WalletApiroutes = express.Router();
const {GenerateToken,GenerateStaticQr,GenerateDynamicQr,webhookForupi} = require("../Controller.js/WalletController");

//  WalletApiroutes.post("/generate-token", GenerateToken);
WalletApiroutes.post("/generate-static-qr", GenerateStaticQr);
WalletApiroutes.post("/generate-dynamic-qr", GenerateDynamicQr);
WalletApiroutes.post("/UpiWebhook", webhookForupi);

module.exports = {WalletApiroutes}