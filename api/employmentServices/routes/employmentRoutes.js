const express = require("express");
const { handleMobileToUan } = require("../controllers/employmentController");

const employmentRouter = express.Router();

employmentRouter.post("/mobile_to_uan", handleMobileToUan)

module.exports = employmentRouter