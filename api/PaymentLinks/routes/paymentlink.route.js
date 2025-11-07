const express = require('express');
const PaymentRouter = express.Router();

const paymentlinkController = require('../controllers/paymentlink.controller');

PaymentRouter.post('/createpaymentlink', paymentlinkController.createPaymentLink);
PaymentRouter.get('/payment-link/:link_id', paymentlinkController.getPaymentLinkDetails);
PaymentRouter.post('/payment-links/:link_id/cancel', paymentlinkController.cancelPaymentLink);
PaymentRouter.get('/get/PaymentLink/transactions', paymentlinkController.getPaymentLinkTransactions);
PaymentRouter.get('/get/PaymentLink/getTodaysTransactions', paymentlinkController.getTodaysTransactions);
PaymentRouter.post('/PaymentLink/create', paymentlinkController.createRazorpayStandardPaymentLink);

//router.post('/fetchAllUserEmails', emailValidator.fetchAllUserEmails,emailController.fetchAllUserEmails);

module.exports = PaymentRouter;
