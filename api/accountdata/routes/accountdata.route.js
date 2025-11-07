const express = require('express');
const Accountrouter = express.Router();

const accountdataController = require('../controllers/accountdata.controller');

Accountrouter.post("/verify-bank-account", accountdataController.verifyBankAccount)

module.exports = Accountrouter;
