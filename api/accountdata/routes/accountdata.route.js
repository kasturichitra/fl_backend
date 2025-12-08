const express = require('express');
const accountRouter = express.Router();

const accountdataController = require('../controllers/accountdata.controller');

accountRouter.post("/verify/penny-drop", accountdataController.verifyPennyDropBankAccount)
accountRouter.post("/verify/penny-less", accountdataController.verifyPennyLessBankAccount)

module.exports = accountRouter;
