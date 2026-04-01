const express = require("express");
const mainRouter = express.Router();

// Routes Imports
const panRouter = require("../api/panServices/routes/panServices.route");
const aadhaarRouter = require("../api/aadharVerification/routes/adhaarverification.route");
const otpRouter = require("../api/otp/routes/otpRoutes");
const accountRouter = require("../api/accountdata/routes/accountdata.route");
const faceRouter = require("../api/facematch/routes/facematch.route");
const nameRouter = require("../api/compareNames/routes/compareNames.route");
const binRouter = require("../api/BinApi/routes/BinRoutes");
const ipRouter = require("../api/whitelistapi/routes/whitelistApi.routes");
const instantPayRouter = require("../api/instantPay/routes/InstantPayRoutes");
const fullCardRouter = require("../api/cardValidation/routes/cardValidationRoutes");
// const sendEmail  = require("../api/Gmail/mailverification");
const analyticdataRouter = require("../api/analytics/routes/analyticdata.route");
const businessRouters = require("../api/businessServices/routes/businessRoutes.js")
const vehicleRouter = require("../api/vehicleServices/routes/vehicleRoutes");
const employmentRouter = require("../api/employmentServices/routes/employmentRoutes");
const bankingRouter = require("../api/bankingServices/routes/bankingRoutes");
const contactRouter = require("../api/contactServices/routes/contactRoute");
const governmentIdRouter = require("../api/governmentIdServices/routes/governmentIdRoutes");
const locationRouter = require("../api/locationServices/routes/locationRoutes.js");
const riskRouter = require("../api/riskServices/routes/riskRoutes.js");
const faceAndAiRouter = require("../api/FaceAndAiServices/routes/faceRoutes.js");

//Routes
mainRouter.use("/pan", panRouter);
mainRouter.use("/business", businessRouters);
mainRouter.use("/aadhaar", aadhaarRouter);
mainRouter.use("/mobileNumber", otpRouter);
// mainRouter.use("/email", sendEmail);
mainRouter.use("/face", faceRouter);
mainRouter.use("/account", accountRouter);
mainRouter.use("/instant", instantPayRouter);
mainRouter.use("/name", nameRouter);
mainRouter.use("/bin", binRouter);
mainRouter.use("/card", fullCardRouter);
mainRouter.use("/IP", ipRouter);
mainRouter.use("/vehicle", vehicleRouter);
mainRouter.use("/employee", employmentRouter);
mainRouter.use("/bank", bankingRouter);
mainRouter.use("/contact", contactRouter);
mainRouter.use("/government", governmentIdRouter);
mainRouter.use("/location", locationRouter);
mainRouter.use("/diligence", riskRouter);
mainRouter.use("/image", faceAndAiRouter);


// no middleware checking for this
mainRouter.use("/analytics", analyticdataRouter);


module.exports = mainRouter;
