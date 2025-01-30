const express = require("express")
const { getCardDetailsByNumber , getBankDetailsByIfsc} = require("../controllers/BinControllers")
const binRouter =  express.Router();

binRouter.post("/getapiDetails",getCardDetailsByNumber)
binRouter.post("/getBankDetails",getBankDetailsByIfsc)

module.exports =binRouter  