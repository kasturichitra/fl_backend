const { createOrder , verifyPayment ,getApiKey ,fetchOrder ,fetchPaymentsForOrder ,fetchPaymentsById,checkPendingTransactions } = require("../Controller/Razorpay.controller") ;
const express = require("express")

const router =  express.Router();

router.post("/createOrder",createOrder);
// router.post("/fetchOrder/:order_id",fetchOrder);
// router.post("/fetchPaymentsOfOrder/:order_id",fetchPaymentsForOrder);

// router.get("/fetchPayment/:payment_id",fetchPaymentsById);
router.post("/verifyPayment",verifyPayment);

router.post("/api/getkey",getApiKey)


module.exports = router ;