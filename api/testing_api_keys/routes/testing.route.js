const express = require("express");
const generateApiKeys = require("../controllers/testing.controller");

const testingApiRouter = express.Router();

testingApiRouter.post("/generateTestCredentials", generateApiKeys)

module.exports = testingApiRouter