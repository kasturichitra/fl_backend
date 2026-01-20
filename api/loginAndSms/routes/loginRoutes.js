const express = require("express")
const {loginDetails , verifyOtp, getUser} = require("../controller/newLoginController");

const loginRouter = express.Router()

loginRouter.post("/loginVerify" ,loginDetails)
loginRouter.post("/otpVerify" , verifyOtp)
loginRouter.get("/getuserDetails" , getUser)


module.exports = loginRouter;