const express = require('express');
const accountRouter = express.Router();

const accountdataController = require('../controllers/accountdata.controller');

accountRouter.post("/pennyDrop/verifyBankAccount", accountdataController.verifyPennyDropBankAccount)
accountRouter.post("/pennyLess/verifyBankAccount", accountdataController.verifyPennyLessBankAccount)

module.exports = accountRouter;
