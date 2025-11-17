const express =require("express")
const bbpsRouter = express.Router();
const  bbpsintegrationController = require("../controllers/BbpsIntegrationController")

bbpsRouter.post("/bbpsBillerInfo", bbpsintegrationController.bbpsBillerInfo);
bbpsRouter.post("/bbpsbillfetch", bbpsintegrationController.bbpsBillFetch);
bbpsRouter.post("/billpayment", bbpsintegrationController.billPayRequest);
// bbpsRouter.post("/billvalidation", bbpsintegrationController.billValidation);
// bbpsRouter.post("/quickpay", bbpsintegrationController.billQuickPay);
// bbpsRouter.post("/transactionstatus", bbpsintegrationController.billTransactionStatus);
// bbpsRouter.post("/complaintregister", bbpsintegrationController.complaintRegister);
// bbpsRouter.post("/complaintTracking", bbpsintegrationController.complaintTracking);
// bbpsRouter.post("/depositEnquiry", bbpsintegrationController.depositEnquiry);
module.exports = bbpsRouter;