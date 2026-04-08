const express = require("express");
const { handleBSAViaNetBanking, AdvanceBankAccountVerification, CibilVerification } = require("../controllers/bankingController");

const bankingRouter = express.Router();

bankingRouter.post("/statement", handleBSAViaNetBanking);
bankingRouter.post("/bankAccount/Verify", AdvanceBankAccountVerification);
bankingRouter.post("/cibil/verify", CibilVerification);

module.exports = bankingRouter;