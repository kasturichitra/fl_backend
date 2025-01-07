const express = require("express")
const {loginDetails , verifyOtp} = require("../controller/loginController")

const loginRouter = express.Router()

loginRouter.post("/loginVerify" , loginDetails)
loginRouter.post("/otpVerify" , verifyOtp)


module.exports = loginRouter;