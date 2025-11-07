const express = require("express")
const { mobileOtpGeneration, verifyMobileOtp} = require("../controller/otpController")

const otpRouter = express.Router()

otpRouter.post("/mobileOtp" , mobileOtpGeneration)
otpRouter.post("/mobileotpVerify" , verifyMobileOtp)


module.exports = otpRouter;