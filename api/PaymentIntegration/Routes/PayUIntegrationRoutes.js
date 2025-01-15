const express=require("express")
const { payUIntegration,getPayuTransactionDetailsById,getGetCreditCardType } = require("../Controller/PayUIntegrationController")
const routes=express.Router()
routes.post("/paymentIntegration",payUIntegration)
routes.post("/getPayuTransactionDetailsById/:transactionId",getPayuTransactionDetailsById)


module.exports=routes