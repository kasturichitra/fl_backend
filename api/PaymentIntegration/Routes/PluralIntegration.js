const { generatePluralToken ,getCallbackUrlOfPluralApi,getTransactionStatus} = require("../Controller/PluralIntegration")
const express = require("express")
const router = express.Router()
router.get("/generate/token", generatePluralToken)
router.post("/get/transactionStatus",getCallbackUrlOfPluralApi)
router.post("/get/transactionStatus/:orderId",getTransactionStatus)

module.exports = router