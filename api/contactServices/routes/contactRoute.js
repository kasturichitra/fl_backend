const express = require("express");
const contactRouter = express.Router();

const {
  handleMobileToPanVerify,
  handleMobileToUanVerify,
  handleAdvanceMobileDataOtpVerify,
  handleAdvanceMobileDataOtp,
} = require("../controllers/contactController");

contactRouter.post("/pan/verify", handleMobileToPanVerify);
contactRouter.post("/uan/verify", handleMobileToUanVerify);
contactRouter.post("/advanceData/getOtp", handleAdvanceMobileDataOtp);
contactRouter.post("/advanceData/otp/verify", handleAdvanceMobileDataOtpVerify);

module.exports = contactRouter;
