const express = require("express")
// const {loginDetails , verifyOtp, getUser} = require("../controller/loginController");
const {loginDetails , verifyOtp, getUser} = require("../controller/newLoginController");
const checkToken = require("../../../middleware/jwt.middleware");

const loginRouter = express.Router()

loginRouter.post("/loginVerify" ,loginDetails)
loginRouter.post("/otpVerify" , verifyOtp)
loginRouter.get("/getuserDetails" , getUser)


module.exports = loginRouter;