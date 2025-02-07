const express = require("express");
const {generateApiKeys, getAllApiKeys, removeOneApi, excelDownload } = require("../controllers/liveKeys.controller");

const LiveApiKeysRouter = express.Router();

LiveApiKeysRouter.post("/generateLiveCredentials", generateApiKeys)
LiveApiKeysRouter.get("/getLiveKeys/:MerchantId", getAllApiKeys)
LiveApiKeysRouter.delete("/removeLiveKey/:id", removeOneApi)
LiveApiKeysRouter.post("/excelLiveKeysDownload", excelDownload)

module.exports = LiveApiKeysRouter