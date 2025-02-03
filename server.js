const express = require("express")
const mongoose = require("mongoose")
const dotenv = require("dotenv")
const cors = require("cors")
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
const jwtauth = require("./middleware/jwt.middleware")
const validateMerchant = require("./middleware/validation.middleware")
const exeptionHandling = require("./api/GlobalExceptionHandling/GlobalExceptionHandlingController")
const helmet = require("helmet")
const bodyParser = require("body-parser")
const UPIrouter = require("./api/PaymentIntegration/Routes/RazorpayRoutes")
const Emailroutes = require("./api/email/routes/email.route")
const testingApiRouter = require("./api/testing_api_keys/routes/testing.route")
const checkWhitelist = require('./middleware/IPAddresswhitelist.middleware')
const ipRouter = require("./api/whitelistapi/routes/whitelistApi.routes")

const app = express()

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

// const corsOptions = {
//   origin: ['http://127.0.0.1:3000'], // List allowed IPs or domains
//   methods: ['GET', 'POST'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
// };

// app.use(cors(corsOptions));
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
    mongoURI = process.env.MONGODBURL ;
  
  }

mongoose.connect(mongoURI).then(() => console.log("DB Connected Successfully")).catch((err) => {
    console.log("DB Connection Failed", err)
})

app.use("/registeration", registerationRouter)
app.use("/login", loginRouter)
app.use("/pan", checkWhitelist, jwtauth , validateMerchant , panRouter);
app.use("/aadhaar",checkWhitelist, jwtauth , validateMerchant ,  aadhaarRouter);
app.use("/otp",checkWhitelist, otpRouter);
app.use("/shop", checkWhitelist, jwtauth , validateMerchant , shopRouter);
app.use("/gst", checkWhitelist, jwtauth , validateMerchant , gstRouter);
app.use("/service",checkWhitelist, serviceRouter);
app.use("/face",checkWhitelist, jwtauth , validateMerchant ,faceRouter)
app.use('/account',checkWhitelist, jwtauth , validateMerchant ,Accountrouter)
app.use("/name",checkWhitelist,jwtauth , validateMerchant , nameRouter)
app.use("/verify",checkWhitelist, verifyNameRouter)
app.use("/bin" ,checkWhitelist,jwtauth, validateMerchant, binRouter)
app.use("/upi", checkWhitelist, UPIrouter)
app.use("/email",checkWhitelist, jwtauth, validateMerchant ,Emailroutes)
app.use("/key", checkWhitelist ,jwtauth , validateMerchant , testingApiRouter)
app.use("/IP", checkWhitelist ,jwtauth , validateMerchant , ipRouter)


app.use(exeptionHandling.GlobalExceptionHandling);

app.listen(port, (err) => {
    if (err) {
        console.log("Server connection Failed")
    }
    console.log(`Server is running on the port ${port}`)
})