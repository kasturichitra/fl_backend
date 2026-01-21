const express = require("express");
const mainRouter = express.Router();

// Middlewares
const validateMerchant = require("../middleware/validation.middleware");
const checkWhitelist = require("../middleware/IPAddresswhitelist.middleware");
const checkKeys = require("../middleware/keyValidation.middleware");
const {
    decryptHybridPayload,
    decryptMiddleware,
    enceryptMiddleware,
} = require("../middleware/decryptPyaload");

// Routes Imports
const loginRouter = require("../api/loginAndSms/routes/loginRoutes");
const registerationRouter = require("../api/registeration/routes/registerationRoutes");
const panRouter = require("../api/panVerification/routes/panverification.route");
const aadhaarRouter = require("../api/aadharVerification/routes/adhaarverification.route");
const otpRouter = require("../api/otp/routes/otpRoutes");
const shopRouter = require("../api/shopEstablishment/routes/shopestablishment.route");
const gstRouter = require("../api/gstin_verify/routes/gstin_verify.route");
const serviceRouter = require("../api/ServiceTrackingModel/routes/ServiceTrackingModel.route");
const accountRouter = require("../api/accountdata/routes/accountdata.route");
const faceRouter = require("../api/facematch/routes/facematch.route");
const nameRouter = require("../api/compareNames/routes/compareNames.route");
const verifyNameRouter = require("../api/verifyPanHolderName/routes/verifyName.route");
const binRouter = require("../api/BinApi/routes/BinRoutes");
const UPIrouter = require("../api/PaymentIntegration/Routes/RazorpayRoutes");
const Emailroutes = require("../api/email/routes/email.route");
const testingApiRouter = require("../api/testing_api_keys/routes/testing.route");
const ipRouter = require("../api/whitelistapi/routes/whitelistApi.routes");
const LiveApiKeysRouter = require("../api/live_api_keys/routes/liveKeys.route");
const NominalRouter = require("../api/NominalCharges/Routes/NominalChargesRoutes");
const PaymentRouter = require("../api/PaymentLinks/routes/paymentlink.route");
const WalletRoutes = require("../api/Wallets/routes/Wallets.routes");
const udyamRouter = require("../api/udhyamVerification/routes/udyamRoutes");
const instantPayRouter = require("../api/instantPay/routes/InstantPayRoutes");
const fullCardRouter = require("../api/cardValidation/routes/cardValidationRoutes");
const RechargeRoute = require("../api/Recharge/routes/reachargeRoutes");
const merchantDetailsRoute = require("../api/merchant/routes/merchant.routes");
const { keysApiroutes } = require("../api/Keysapi/keysapi.routes");


// ================== Public/Open Routes ==================
// These routes do NOT need encryption, key validation, or whitelisting
mainRouter.use("/registeration", registerationRouter);
mainRouter.use("/login", loginRouter);
mainRouter.use("/ApiModuel", keysApiroutes);
mainRouter.use("/merchant", merchantDetailsRoute);


// ================== Protected Routes ==================
// Common Middleware Stack for Protected Routes
// Order: IP Check -> Key Check -> Decrypt Request -> Setup Encrypt Response -> Router
// Note: enceryptMiddleware must be BEFORE the router to intercept res.json

const protectedMiddleware = [
    // checkWhitelist,
    // checkKeys,
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
