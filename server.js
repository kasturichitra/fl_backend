const express = require("express")
const mongoose = require("mongoose")
const dotenv = require("dotenv")
const cors = require("cors")

// routers

const loginRouter = require("./api/loginAndSms/routes/loginRoutes")
const registerationRouter = require("./api/registeration/routes/registerationRoutes")
const panRouter = require("./api/panVerification/routes/panverification.route")
const aadhaarRouter = require("./api/aadharVerification/routes/adhaarverification.route")
const otpRouter = require("./api/otp/routes/otpRoutes")
const shopRouter = require("./api/shopEstablishment/routes/shopestablishment.route")
const gstRouter = require("./api/gstin_verify/routes/gstin_verify.route")
const serviceRouter = require("./api/ServiceTrackingModel/routes/ServiceTrackingModel.route")
const accountRouter = require("./api/accountdata/routes/accountdata.route")
const faceRouter = require("./api/facematch/routes/facematch.route")
const nameRouter = require("./api/compareNames/routes/compareNames.route")
const verifyNameRouter = require("./api/verifyPanHolderName/routes/verifyName.route")
const binRouter = require("./api/BinApi/routes/BinRoutes")
const exeptionHandling = require("./api/GlobalExceptionHandling/GlobalExceptionHandlingController")
const helmet = require("helmet")
const bodyParser = require("body-parser")
const UPIrouter = require("./api/PaymentIntegration/Routes/RazorpayRoutes")
const Emailroutes = require("./api/email/routes/email.route")
const testingApiRouter = require("./api/testing_api_keys/routes/testing.route")
const ipRouter = require("./api/whitelistapi/routes/whitelistApi.routes")
const LiveApiKeysRouter = require("./api/live_api_keys/routes/liveKeys.route")
const NominalRouter = require("./api/NominalCharges/Routes/NominalChargesRoutes")
const PaymentRouter = require("./api/PaymentLinks/routes/paymentlink.route")
const WalletRoutes = require("./api/Wallets/routes/Wallets.routes");
const udyamRouter = require("./api/udhyamVerification/routes/udyamRoutes")
const instantPayRouter = require("./api/instantPay/routes/InstantPayRoutes")


// middlewares
const validateMerchant = require("./middleware/validation.middleware")
const jwtauth = require("./middleware/jwt.middleware")
const checkWhitelist = require('./middleware/IPAddresswhitelist.middleware')
const checkKeys = require("./middleware/keyValidation.middleware")
const kycCheck = require("./middleware/kyc.middleware")
const HandileCharges = require('./middleware/ServicesCharges.middleware')
const fullCardRouter = require("./api/cardValidation/routes/cardValidationRoutes")
const RechargeRoute = require("./api/Recharge/routes/reachargeRoutes")
const { decryptHybridPayload, decryptMiddleware, enceryptMiddleware } = require("./middleware/decryptPyaload")
const { keysApiroutes } = require("./api/Keysapi/keysapi.routes")

const app = express()

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

app.use(cors());
dotenv.config()
const port = process.env.PORT

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

database = {
  host: process.env.MONGODB_HOST,
  port: process.env.MONGODB_PORT,
  db: process.env.MONGODB_DB,
  user: process.env.MONGODB_USERNAME,
  pass: process.env.MONGODB_PASSWORD
}
let mongoURI;
if (process.env.NODE_ENV == "production") {
  mongoURI = `mongodb://${database.user}:${database.pass}@${database.host}:${database.port}/${database.db}`;
} else {
  mongoURI = process.env.MONGODBURL;
}

mongoose.connect(mongoURI).then(() => console.log("**************************DB Connected Successfully***************************")).catch((err) => {
  console.log("DB Connection Failed", err)
})

//  jwtauth, validateMerchant, kycCheck, checkWhitelist, checkKeys, HandileCharges,

// Api Moduel sign and login
app.use("/registeration", registerationRouter);
app.use("/login", loginRouter);
app.use("/ApiModuel", keysApiroutes);

// FetchUser Details 
const merchantDetailsRoute = require('./api/merchant/routes/merchant.routes')
app.use('/merchant',jwtauth,merchantDetailsRoute)

// Api Moduel other Routes
// decryptMiddleware loginRouter, enceryptMiddleware
app.use("/service",decryptMiddleware, serviceRouter,enceryptMiddleware);
app.use("/charge",decryptMiddleware, NominalRouter,enceryptMiddleware);
app.use("/upi",decryptMiddleware, UPIrouter,enceryptMiddleware)
app.use("/pay",decryptMiddleware, PaymentRouter,enceryptMiddleware)
app.use('/wallet',decryptMiddleware, WalletRoutes,enceryptMiddleware);
app.use("/pan",decryptMiddleware, panRouter,enceryptMiddleware);
app.use("/aadhaar",decryptMiddleware, aadhaarRouter,enceryptMiddleware);
app.use("/mobileNumber",decryptMiddleware, otpRouter,enceryptMiddleware);
app.use("/shop",decryptMiddleware, shopRouter,enceryptMiddleware);
app.use("/business",decryptMiddleware, gstRouter,enceryptMiddleware);
app.use("/face",decryptMiddleware, faceRouter,enceryptMiddleware)
app.use('/accounts',decryptMiddleware, accountRouter,enceryptMiddleware)
app.use('/instant',decryptMiddleware, instantPayRouter,enceryptMiddleware)
app.use('/udyam',decryptMiddleware, udyamRouter,enceryptMiddleware)
app.use("/name",decryptMiddleware,nameRouter,enceryptMiddleware);
app.use("/verify",decryptMiddleware,verifyNameRouter,enceryptMiddleware);
app.use("/bin",decryptMiddleware,binRouter,enceryptMiddleware);
app.use("/card",decryptMiddleware,fullCardRouter,enceryptMiddleware);
app.use("/email",decryptMiddleware,Emailroutes,enceryptMiddleware);
app.use("/testkey",decryptMiddleware,testingApiRouter,enceryptMiddleware)
app.use("/livekey",decryptMiddleware,LiveApiKeysRouter,enceryptMiddleware)
app.use("/IP",decryptMiddleware,ipRouter,enceryptMiddleware)
app.use('/Recharge',decryptMiddleware, RechargeRoute,enceryptMiddleware)

app.use(exeptionHandling.GlobalExceptionHandling);

app.listen(port, (err) => {
  if (err) {
    console.log("Server connection Failed")
  }
  console.log(`Server is running on the port ${port}`)
})