const express = require("express");
const {generateApiKeys, getAllApiKeys, removeOneApi } = require("../controllers/testing.controller");

const testingApiRouter = express.Router();

testingApiRouter.post("/generateTestCredentials", generateApiKeys)
testingApiRouter.get("/getKeys/:MerchantId", getAllApiKeys)
testingApiRouter.delete("/removeKey/:id", removeOneApi)

module.exports = testingApiRouter