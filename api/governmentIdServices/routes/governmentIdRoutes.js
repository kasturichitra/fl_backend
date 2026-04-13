const express = require("express");
const governmentIdRouter = express.Router();

const {
  handleVoterIdVerify,handlePassportVerify,handleElectricityBill,
  handlePassportFileNoVerify,handlePassportOcrVerify,handleTINVerification,
} = require("../controllers/governmentIdController");

governmentIdRouter.post("/voterId/verify", handleVoterIdVerify);
governmentIdRouter.post("/passport_fileNo/verify", handlePassportFileNoVerify);
governmentIdRouter.post("/electricity_bill", handleElectricityBill);
governmentIdRouter.post("/passport/verify", handlePassportVerify);
governmentIdRouter.post("/passport_ocr/verify", handlePassportOcrVerify);
governmentIdRouter.post('/tin/verify', handleTINVerification);

module.exports = governmentIdRouter;
