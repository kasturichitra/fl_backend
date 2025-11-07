const { createOrder , verifyPayment ,getApiKey ,fetchOrder ,fetchPaymentsForOrder ,fetchPaymentsById,checkPendingTransactions } = require("../Controller/Razorpay.controller") ;
const express = require("express")

const UPIrouter =  express.Router();

UPIrouter.post("/createOrder",createOrder);
// UPIrouter.post("/fetchOrder/:order_id",fetchOrder);
// UPIrouter.post("/fetchPaymentsOfOrder/:order_id",fetchPaymentsForOrder);

// UPIrouter.get("/fetchPayment/:payment_id",fetchPaymentsById);
UPIrouter.post("/verifyPayment",verifyPayment);

UPIrouter.post("/api/getkey",getApiKey)


module.exports = UPIrouter ;