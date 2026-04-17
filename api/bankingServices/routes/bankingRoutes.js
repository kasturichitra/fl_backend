const express = require("express");
const { handleBSAViaNetBanking, AdvanceBankAccountVerification, CibilVerification, handleChequeClassification } = require("../controllers/bankingController");

const bankingRouter = express.Router();

bankingRouter.post("/statement", handleBSAViaNetBanking); // need to conferm
bankingRouter.post("/bankAccount/Verify", AdvanceBankAccountVerification);
bankingRouter.post("/cibil/verify", CibilVerification);
bankingRouter.post("/cheque/verify", handleChequeClassification);

module.exports = bankingRouter;
