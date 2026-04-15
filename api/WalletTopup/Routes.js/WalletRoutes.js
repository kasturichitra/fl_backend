const express = require('express');
const WalletApiroutes = express.Router();
const {
  GenerateToken,
  GenerateStaticQr,
  GenerateDynamicQr,
} = require("../Controller.js/WalletController");

//  WalletApiroutes.post("/generate-token", GenerateToken);
WalletApiroutes.post("/generate-static-qr", GenerateStaticQr);
WalletApiroutes.post("/generate-dynamic-qr", GenerateDynamicQr);

module.exports = {WalletApiroutes}