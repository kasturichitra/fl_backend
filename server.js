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
const checkWhitelist = require("./middleware/IPAddresswhitelist.middleware");
const checkKeys = require("./middleware/keyValidation.middleware");
const { sendEmail } = require("./api/Gmail/mailverification");


const app = express();

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

app.use(cors());
const port = process.env.PORT;

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

database = {
  host: process.env.MONGODB_HOST,
  port: process.env.MONGODB_PORT,
  db: process.env.MONGODB_DB,
  user: process.env.MONGODB_USERNAME,
  pass: process.env.MONGODB_PASSWORD,
};
let mongoURI;
if (process.env.NODE_ENV == "production") {
  mongoURI = `mongodb://${database.user}:${database.pass}@${database.host}:${database.port}/${database.db}`;
} else {
  mongoURI = process.env.MONGODBURL;
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

const protectedMiddleware = [
  // checkWhitelist,
  // checkKeys,
  decryptMiddleware,
  enceryptMiddleware
];

// Use Main Routes
app.use("/", ...protectedMiddleware, mainRoutes);
app.post('/Sendmail', sendEmail)
app.use("/inhouse", mainRoutes);

// Test Server is Wroking
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date(), message: 'form MicroService Health check' });
});


app.use(exeptionHandling.GlobalExceptionHandling);

app.listen(port, (err) => {
  if (err) {
    console.log("Server connection Failed");
  }
  console.log(`Server is running on the port ${port}`);
});

