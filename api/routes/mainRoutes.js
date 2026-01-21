const express = require("express");
const mainRouter = express.Router();

// Middlewares
const validateMerchant = require("../../middleware/validation.middleware");
const checkWhitelist = require("../../middleware/IPAddresswhitelist.middleware");
const checkKeys = require("../../middleware/keyValidation.middleware");
const {
    decryptHybridPayload,
    decryptMiddleware,
    enceryptMiddleware,
} = require("../../middleware/decryptPyaload");

// Routes Imports
const loginRouter = require("../loginAndSms/routes/loginRoutes");
const registerationRouter = require("../registeration/routes/registerationRoutes");
const panRouter = require("../panVerification/routes/panverification.route");
const aadhaarRouter = require("../aadharVerification/routes/adhaarverification.route");
const otpRouter = require("../otp/routes/otpRoutes");
const shopRouter = require("../shopEstablishment/routes/shopestablishment.route");
const gstRouter = require("../gstin_verify/routes/gstin_verify.route");
const serviceRouter = require("../ServiceTrackingModel/routes/ServiceTrackingModel.route");
const accountRouter = require("../accountdata/routes/accountdata.route");
const faceRouter = require("../facematch/routes/facematch.route");
const nameRouter = require("../compareNames/routes/compareNames.route");
const verifyNameRouter = require("../verifyPanHolderName/routes/verifyName.route");
const binRouter = require("../BinApi/routes/BinRoutes");
const UPIrouter = require("../PaymentIntegration/Routes/RazorpayRoutes");
const Emailroutes = require("../email/routes/email.route");
const testingApiRouter = require("../testing_api_keys/routes/testing.route");
const ipRouter = require("../whitelistapi/routes/whitelistApi.routes");
const LiveApiKeysRouter = require("../live_api_keys/routes/liveKeys.route");
const NominalRouter = require("../NominalCharges/Routes/NominalChargesRoutes");
const PaymentRouter = require("../PaymentLinks/routes/paymentlink.route");
const WalletRoutes = require("../Wallets/routes/Wallets.routes");
const udyamRouter = require("../udhyamVerification/routes/udyamRoutes");
const instantPayRouter = require("../instantPay/routes/InstantPayRoutes");
const fullCardRouter = require("../cardValidation/routes/cardValidationRoutes");
const RechargeRoute = require("../Recharge/routes/reachargeRoutes");
const merchantDetailsRoute = require("../merchant/routes/merchant.routes");
const { keysApiroutes } = require("../Keysapi/keysapi.routes");


// ================== Public/Open Routes ==================
// These routes do NOT need encryption, key validation, or whitelisting (based on previous server.js)
mainRouter.use("/registeration", registerationRouter);
mainRouter.use("/login", loginRouter);
mainRouter.use("/ApiModuel", keysApiroutes);
mainRouter.use("/merchant", merchantDetailsRoute);


// ================== Protected Routes ==================
// Common Middleware Stack for Protected Routes
// Order: IP Check -> Key Check -> Decrypt Request -> Setup Encrypt Response -> Router
// Note: enceryptMiddleware must be BEFORE the router to intercept res.json

const protectedMiddleware = [
    checkWhitelist,
    checkKeys,
    decryptMiddleware,
    enceryptMiddleware
];

mainRouter.use("/service", ...protectedMiddleware, serviceRouter);
mainRouter.use("/charge", ...protectedMiddleware, NominalRouter);
mainRouter.use("/upi", ...protectedMiddleware, UPIrouter);
mainRouter.use("/pay", ...protectedMiddleware, PaymentRouter);
mainRouter.use("/wallet", ...protectedMiddleware, WalletRoutes);
mainRouter.use("/pan", ...protectedMiddleware, panRouter);
mainRouter.use("/aadhaar", ...protectedMiddleware, aadhaarRouter);
mainRouter.use("/mobileNumber", ...protectedMiddleware, otpRouter);
mainRouter.use("/shop", ...protectedMiddleware, shopRouter);
mainRouter.use("/business", ...protectedMiddleware, gstRouter);
mainRouter.use("/face", ...protectedMiddleware, faceRouter);
mainRouter.use("/accounts", ...protectedMiddleware, accountRouter);
mainRouter.use("/instant", ...protectedMiddleware, instantPayRouter);
mainRouter.use("/udyam", ...protectedMiddleware, udyamRouter);
mainRouter.use("/name", ...protectedMiddleware, nameRouter);
mainRouter.use("/verify", ...protectedMiddleware, verifyNameRouter);
mainRouter.use("/bin", ...protectedMiddleware, binRouter);
mainRouter.use("/card", ...protectedMiddleware, fullCardRouter);
mainRouter.use("/email", ...protectedMiddleware, Emailroutes);
mainRouter.use("/testkey", ...protectedMiddleware, testingApiRouter);
mainRouter.use("/livekey", ...protectedMiddleware, LiveApiKeysRouter);
mainRouter.use("/IP", ...protectedMiddleware, ipRouter);
mainRouter.use("/Recharge", ...protectedMiddleware, RechargeRoute);


module.exports = mainRouter;
