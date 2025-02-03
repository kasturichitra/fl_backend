const express = require("express");
const {generateApiKeys, getAllApiKeys, removeOneApi, excelDownload } = require("../controllers/testing.controller");

const testingApiRouter = express.Router();

testingApiRouter.post("/generateTestCredentials", generateApiKeys)
testingApiRouter.get("/getKeys/:MerchantId", getAllApiKeys)
testingApiRouter.delete("/removeKey/:id", removeOneApi)
testingApiRouter.post("/excelDownload", excelDownload)

module.exports = testingApiRouter