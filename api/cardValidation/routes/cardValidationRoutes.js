const express = require("express");
const { verifyFullCardNumber } = require("../controllers/cardValidation.controller");
const fullCardRouter = express?.Router();

fullCardRouter.post("/cardVerify", verifyFullCardNumber)

module.exports = fullCardRouter