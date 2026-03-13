const express = require("express");
const { gstAnalyticsGetOtp, gstAnalyticsOtpVerify } = require("../controllers/gstServiceController");

const gstRouter = express.Router();

gstRouter.post("/gstAnalytics/getOtp", gstAnalyticsGetOtp)
gstRouter.post("/gstAnalytics/verifyOtp", gstAnalyticsOtpVerify)

module.exports = gstRouter