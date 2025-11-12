const express = require("express");
const InstantPayPaymentCreation = require("../controller/InstantPayController");

const instantPayRouter = express.Router();

instantPayRouter.post("/cardPayment", InstantPayPaymentCreation)

module.exports = instantPayRouter;