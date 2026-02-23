const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const exeptionHandling = require("./api/GlobalExceptionHandling/GlobalExceptionHandlingController");
const mainRoutes = require("./routes/mainRoutes");
const { decryptMiddleware, enceryptMiddleware } = require("./middleware/decryptPyaload");
const checkWhitelist = require("./middleware/ClientValidation.middleware");
const { keysApiroutes } = require("./api/Keysapi/keysapi.routes");
const { callTruthScreenAPI } = require("./api/truthScreen/callTruthScreen");

const app = express();

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

app.use(cors());
const port = process.env.PORT;

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// database = {
//   host: process.env.MONGODB_HOST_UAT,
//   port: process.env.MONGODB_PORT_UAT,
//   db: process.env.MONGODB_DB_UAT,
//   user: process.env.MONGODB_USERNAME_UAT,
//   pass: process.env.MONGODB_PASSWORD_UAT,
// };
uatdatabase = {
  host: process.env.MONGODB_HOST_UAT,
  port: process.env.MONGODB_PORT_UAT,
  db: process.env.MONGODB_DB_UAT,
  user: process.env.MONGODB_USERNAME_UAT,
  pass: process.env.MONGODB_PASSWORD_UAT,
};
let mongoURI;
if (process.env.NODE_ENV == "production") {
  mongoURI = `mongodb://${database.user}:${database.pass}@${database.host}:${database.port}/${database.db}`;
} else {
  mongoURI = `mongodb://${uatdatabase.user}:${uatdatabase.pass}@${uatdatabase.host}:${uatdatabase.port}/${uatdatabase.db}?authSource=admin`;
  console.log("connected to uat data base ====>>>")
}

mongoose
  .connect(mongoURI)
  .then(() =>
    console.log(
      "**************************DB Connected Successfully***************************"
    )
  )
  .catch((err) => {
    console.log("DB Connection Failed", err);
  });

// Middleware definitions removed - moved to local scopes or mainRoutes


// ================== Public/Open Routes ==================
// These routes do NOT need encryption, key validation, or whitelisting
app.use("/kyc/api/v1/ApiModuels", keysApiroutes);

// Use Main Routes
app.use("/kyc/api/v1", mainRoutes);
app.use("/kyc/api/v1/inhouse", mainRoutes);

// For Testing
const { TestTruthScreen } = require("./api/TruthScreenTestController/TestTruthScreen.controller");
app.post("/kyc/api/v1/test", TestTruthScreen);

app.use(exeptionHandling.GlobalExceptionHandling);

app.listen(port, (err) => {
  if (err) {
    console.log("Server connection Failed");
  }
  console.log(`Server is running on the port ${port}`);
});

