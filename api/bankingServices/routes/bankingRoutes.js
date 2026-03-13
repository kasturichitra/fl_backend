const express = require("express");
const { handleBSAViaNetBanking } = require("../controllers/bankingController");

const bankingRouter = express.Router();

bankingRouter.post("/statement", handleBSAViaNetBanking)

module.exports = bankingRouter