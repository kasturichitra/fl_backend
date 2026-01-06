const express = require("express")
const { mobileOtpGeneration, verifyMobileOtp} = require("../controller/otpController")

const otpRouter = express.Router()

otpRouter.post("/otp_generation" , mobileOtpGeneration)
otpRouter.post("/otp_verification" , verifyMobileOtp)


module.exports = otpRouter;