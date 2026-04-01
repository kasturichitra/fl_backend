const express = require("express");
const { handleBasicUanVerify, handleDualEmploymentCheck } = require("../controllers/employmentController");

const employmentRouter = express.Router();

employmentRouter.post("/uan/basic", handleBasicUanVerify)
employmentRouter.post("/dual_employment/check", handleDualEmploymentCheck)

module.exports = employmentRouter