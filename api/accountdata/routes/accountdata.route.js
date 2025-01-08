const express = require('express');
const Accountrouter = express.Router();

const accountdataController = require('../controllers/accountdata.controller');
const accountdataValidator = require('../validations/accountdata.validator');

Accountrouter.post("/verify-bank-account",accountdataValidator.verifyBankAccount,accountdataController.verifyBankAccount)

module.exports = Accountrouter;
