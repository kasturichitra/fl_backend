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
const Accountrouter = require("./api/accountdata/routes/accountdata.route")
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


// middlewares
const validateMerchant = require("./middleware/validation.middleware")
const jwtauth = require("./middleware/jwt.middleware")
const checkWhitelist = require('./middleware/IPAddresswhitelist.middleware')
const checkKeys = require("./middleware/keyValidation.middleware")
const kycCheck = require("./middleware/kyc.middleware")
const HandileCharges = require('./middleware/ServicesCharges.middleware')
const fullCardRouter = require("./api/cardValidation/routes/cardValidationRoutes")
const RechargeRoute = require("./api/Recharge/routes/reachargeRoutes")

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

app.use("/registeration", registerationRouter)
app.use("/login", loginRouter)
app.use("/service", serviceRouter);
app.use("/charge", NominalRouter);
app.use("/upi", UPIrouter)
app.use("/pay", PaymentRouter)
app.use('/wallet',jwtauth, validateMerchant,kycCheck, checkWhitelist,WalletRoutes)
// app.use("/pan", jwtauth, validateMerchant,kycCheck, checkWhitelist,checkKeys, HandileCharges, panRouter);
app.use("/pan", jwtauth, validateMerchant,kycCheck, panRouter);
// app.use("/aadhaar", jwtauth, validateMerchant,kycCheck, checkWhitelist, checkKeys, HandileCharges, aadhaarRouter);
app.use("/aadhaar",  aadhaarRouter);
app.use("/otp", jwtauth, validateMerchant,  kycCheck, checkWhitelist,checkKeys, HandileCharges, otpRouter);
app.use("/shop", jwtauth, validateMerchant, kycCheck, checkWhitelist,checkKeys,HandileCharges, shopRouter);
app.use("/gst", jwtauth, validateMerchant, kycCheck, checkWhitelist,checkKeys, HandileCharges, gstRouter);
app.use("/face", jwtauth, validateMerchant, kycCheck, checkWhitelist , checkKeys, HandileCharges, faceRouter)
app.use('/account', jwtauth, validateMerchant, kycCheck, checkWhitelist,checkKeys,HandileCharges , Accountrouter)
app.use("/name", jwtauth, validateMerchant, kycCheck, checkWhitelist,checkKeys,HandileCharges , nameRouter)
app.use("/verify", jwtauth, validateMerchant, kycCheck, checkWhitelist,checkKeys,HandileCharges , verifyNameRouter)
// app.use("/bin", jwtauth, validateMerchant, kycCheck, checkWhitelist,checkKeys,HandileCharges , binRouter)
app.use("/bin", jwtauth, validateMerchant, kycCheck, binRouter)
app.use("/card", jwtauth, validateMerchant, kycCheck, fullCardRouter)
app.use("/email", jwtauth, validateMerchant, kycCheck, checkWhitelist,checkKeys,HandileCharges , Emailroutes)
app.use("/key", jwtauth, validateMerchant, kycCheck, checkWhitelist, testingApiRouter)
app.use("/key", jwtauth, validateMerchant, kycCheck, checkWhitelist, LiveApiKeysRouter)
app.use("/IP", jwtauth, validateMerchant,  ipRouter)
app.use('/Reacharge',jwtauth,RechargeRoute)

app.use(exeptionHandling.GlobalExceptionHandling);

app.listen(port, (err) => {
  if (err) {
    console.log("Server connection Failed")
  }
  console.log(`Server is running on the port ${port}`)
})