const express = require("express");
const { verifyFullCardNumber } = require("../controllers/cardValidation.controller");
const fullCardRouter = express?.Router();

fullCardRouter.post("/Verify", verifyFullCardNumber)

module.exports = fullCardRouter