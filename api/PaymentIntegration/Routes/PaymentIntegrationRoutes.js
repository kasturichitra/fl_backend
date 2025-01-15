const {getPaymentToken,panVerificationBeneficiary,cashFreePayment,getPaymentStatus,getQrCodeGeneration}=require("../Controller/PaymentIntegrationController")
const express=require("express")
const router=express.Router()
router.post("/panVerify/verify",panVerificationBeneficiary)
router.post("/cashfree/cashFreePayment",cashFreePayment)
router.post("/cashFreePayment/paymentStatus/:orderId/:paymentId",getPaymentStatus)
router.get("/cashFreePayment/getQrCodeGeneration",getQrCodeGeneration)
module.exports=router