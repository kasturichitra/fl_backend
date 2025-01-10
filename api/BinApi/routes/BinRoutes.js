const express = require("express")
const { getCardDetailsByNumber , getBankDetailsByIfsc} = require("../controllers/BinControllers")
const binRouter =  express.Router();

binRouter.get("/getrapiDetails",getCardDetailsByNumber)
binRouter.get("/getBankDetails",getBankDetailsByIfsc)

module.exports =binRouter  