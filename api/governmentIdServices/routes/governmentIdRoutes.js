const express = require("express");
const governmentIdRouter = express.Router();

const {
  handleVoterIdVerify,
  handlePassportVerify,
  handleElectricityBill,
  handlePassportFileNoVerify,
  handlePassportOcrVerify,
} = require("../controllers/governmentIdController");

governmentIdRouter.post("/voterId/verify", handleVoterIdVerify);
governmentIdRouter.post("/passport_fileNo/verify", handlePassportFileNoVerify);
governmentIdRouter.post("/electricity_bill", handleElectricityBill);
governmentIdRouter.post("/passport/verify", handlePassportVerify);
governmentIdRouter.post("/passport_ocr/verify", handlePassportOcrVerify);

module.exports = governmentIdRouter;
