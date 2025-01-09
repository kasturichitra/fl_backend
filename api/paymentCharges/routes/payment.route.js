const express = require("express")

const paymentRouter = express.Router();

paymentRouter.post("/createPayment")
paymentRouter.put("/changePayment")
paymentRouter.delete("/deletePayment")

module.exports = paymentRouter