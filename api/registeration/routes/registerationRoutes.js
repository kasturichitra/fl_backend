const express = require("express")
const {registerationVerify , allUsers}  = require("../controller/registerationController")
const registerationValidator = require("../validations/registerationValidator")

const registerationRouter = express.Router()

registerationRouter.post("/registerationCredentials" ,registerationValidator.signUp, registerationVerify)
registerationRouter.get("/getAllUsers" , allUsers)


module.exports = registerationRouter;