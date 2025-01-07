const express = require('express');
const Accountrouter = express.Router();

const accountdataController = require('../controllers/accountdata.controller');
const accountdataValidator = require('../validations/accountdata.validator');

Accountrouter.post("/verify-bank-account",accountdataController.verifyBankAccount,accountdataValidator.verifyBankAccount)
Accountrouter.post("/verifyUsername",accountdataController.verifyUsername,accountdataValidator.verifyAccount)
module.exports = Accountrouter;
