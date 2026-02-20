const express = require("express");
const mainRouter = express.Router();

// Middlewares
const checkWhitelist = require("../middleware/IPAddresswhitelist.middleware");
const {
    decryptMiddleware,
    enceryptMiddleware,
} = require("../middleware/decryptPyaload");

// Routes Imports
const panRouter = require("../api/panVerification/routes/panverification.route");
const aadhaarRouter = require("../api/aadharVerification/routes/adhaarverification.route");
const otpRouter = require("../api/otp/routes/otpRoutes");
const shopRouter = require("../api/shopEstablishment/routes/shopestablishment.route");
const gstRouter = require("../api/gstin_verify/routes/gstin_verify.route");
const accountRouter = require("../api/accountdata/routes/accountdata.route");
const faceRouter = require("../api/facematch/routes/facematch.route");
const nameRouter = require("../api/compareNames/routes/compareNames.route");
const binRouter = require("../api/BinApi/routes/BinRoutes");
const testingApiRouter = require("../api/testing_api_keys/routes/testing.route");
const ipRouter = require("../api/whitelistapi/routes/whitelistApi.routes");
const LiveApiKeysRouter = require("../api/live_api_keys/routes/liveKeys.route");
const udyamRouter = require("../api/udhyamVerification/routes/udyamRoutes");
const instantPayRouter = require("../api/instantPay/routes/InstantPayRoutes");
const fullCardRouter = require("../api/cardValidation/routes/cardValidationRoutes");
const { sendEmail } = require("../api/Gmail/mailverification");
const VoterIdRouter = require("../api/VoterId/voter.routes");
const AuthValidation = require("../middleware/keyValidation.middleware");
const analyticdataRouter = require("../api/analytics/routes/analyticdata.route");

// ================== Public/Utils Routes ==================
mainRouter.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date(), message: 'MicroService Health check' });
});

// ================== API Keys (Unprotected) ==================
// "get apikeys (without middlware fornow)"
mainRouter.use("/testkey", testingApiRouter);
mainRouter.use("/livekey", LiveApiKeysRouter);


// ================== Protected Routes (KYC) ==================
// Common Middleware Stack for Protected Routes
// Order: IP Check -> Key Check -> Decrypt Request -> Setup Encrypt Response -> Router
// Note: enceryptMiddleware must be BEFORE the router to intercept res.json

const protectedMiddleware = [
    checkWhitelist,
    // AuthValidation, // Need to remove
    decryptMiddleware,
    enceryptMiddleware
];

// Helper to bypass middleware for "In House" routes (mounted at /inhouse)
const bypassIfInHouse = (middleware) => (req, res, next) => {
    if (req.baseUrl.includes('inhouse')) return next();
    return middleware(req, res, next);
};

const conditionalMiddleware = protectedMiddleware.map(bypassIfInHouse);

mainRouter.use("/pan", ...conditionalMiddleware, panRouter);
mainRouter.use("/aadhaar", ...conditionalMiddleware, aadhaarRouter);
mainRouter.use("/mobileNumber", ...conditionalMiddleware, otpRouter);
mainRouter.use("/email", ...conditionalMiddleware, sendEmail);
mainRouter.use("/shop", ...conditionalMiddleware, shopRouter);
mainRouter.use("/business", ...conditionalMiddleware, gstRouter);
mainRouter.use("/face", ...conditionalMiddleware, faceRouter);
mainRouter.use("/accounts", ...conditionalMiddleware, accountRouter);
mainRouter.use("/instant", ...conditionalMiddleware, instantPayRouter);
mainRouter.use("/udyam", ...conditionalMiddleware, udyamRouter);
mainRouter.use("/name", ...conditionalMiddleware, nameRouter);
mainRouter.use("/bin", ...conditionalMiddleware, binRouter);
mainRouter.use("/card", ...conditionalMiddleware, fullCardRouter);
mainRouter.use("/IP", ...conditionalMiddleware, ipRouter);
// mainRouter.use("/voterId", ...conditionalMiddleware, VoterIdRouter);
mainRouter.use("/analytics", ...conditionalMiddleware, analyticdataRouter);


module.exports = mainRouter;
