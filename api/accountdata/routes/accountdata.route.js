const express = require('express');
const accountRouter = express.Router();

const accountdataController = require('../controllers/accountdata.controller');

accountRouter.post("/pd/verifyBankAccount", accountdataController.verifyPennyDropBankAccount)
accountRouter.post("/pl/verifyBankAccount", accountdataController.verifyPennyLessBankAccount)

module.exports = accountRouter;
