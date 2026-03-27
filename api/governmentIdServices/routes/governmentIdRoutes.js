const express = require("express");
const governmentIdRouter = express.Router();

const {
  handleVoterIdVerify,
  handlePassportVerify,
  handleElectricityBill,
} = require("../controllers/governmentIdController");

governmentIdRouter.post("/voterId/verify", handleVoterIdVerify);
governmentIdRouter.post("/passport/verify", handlePassportVerify);
governmentIdRouter.post("/electricity_bill", handleElectricityBill);

module.exports = governmentIdRouter;
