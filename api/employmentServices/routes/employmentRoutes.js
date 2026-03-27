const express = require("express");
const { handleBasicUanVerify } = require("../controllers/employmentController");

const employmentRouter = express.Router();

employmentRouter.post("/uan/basic", handleBasicUanVerify)

module.exports = employmentRouter