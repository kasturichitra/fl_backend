const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const bodyParser = require("body-parser");

const exeptionHandling = require("./api/GlobalExceptionHandling/GlobalExceptionHandlingController");
const mainRoutes = require("./routes/mainRoutes");


const app = express();

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

app.use(cors());
dotenv.config();
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


// Use Main Routes
app.use("/", mainRoutes);


app.use(exeptionHandling.GlobalExceptionHandling);

app.listen(port, (err) => {
  if (err) {
    console.log("Server connection Failed");
  }
  console.log(`Server is running on the port ${port}`);
});

