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

const app = express()

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(cors())
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
app.use("/pan", jwtauth , validateMerchant , panRouter);
app.use("/aadhaar",  aadhaarRouter);
app.use("/otp", otpRouter);
app.use("/shop", shopRouter);
app.use("/gst", gstRouter);
app.use("/service", serviceRouter);
app.use("/face",faceRouter)
app.use('/account',Accountrouter)
app.use("/name", nameRouter)
app.use("/verify", verifyNameRouter)
app.use("/bin", binRouter)
app.use("/upi",UPIrouter)
app.use("/email", jwtauth, validateMerchant ,Emailroutes)


app.use(exeptionHandling.GlobalExceptionHandling);

app.listen(port, (err) => {
    if (err) {
        console.log("Server connection Failed")
    }
    console.log(`Server is running on the port ${port}`)
})