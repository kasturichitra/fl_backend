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
// app.use('/user',)

// Api Moduel other Routes
// decryptMiddleware loginRouter, enceryptMiddleware
app.use("/service", serviceRouter,);
app.use("/charge", NominalRouter,);
app.use("/upi", UPIrouter,)
app.use("/pay", PaymentRouter,)
app.use('/wallet', WalletRoutes,);
app.use("/pan", panRouter);
app.use("/aadhaar", aadhaarRouter);
app.use("/mobileNumber", otpRouter);
app.use("/shop", shopRouter);
app.use("/business", gstRouter);
app.use("/face", faceRouter)
app.use('/account', accountRouter)
app.use('/instant', instantPayRouter)
app.use('/udyam', udyamRouter)
app.use("/name",nameRouter)
app.use("/verify",verifyNameRouter)
app.use("/bin",binRouter)
app.use("/card",fullCardRouter)
app.use("/email",Emailroutes)
app.use("/testkey",testingApiRouter)
app.use("/livekey",LiveApiKeysRouter)
app.use("/IP",ipRouter)
app.use('/Recharge', RechargeRoute)

app.use(exeptionHandling.GlobalExceptionHandling);

app.listen(port, (err) => {
  if (err) {
    console.log("Server connection Failed")
  }
  console.log(`Server is running on the port ${port}`)
})