const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const exceptionHandling = require("./api/GlobalExceptionHandling/GlobalExceptionHandlingController");
const mainRoutes = require("./routes/mainRoutes");
const {
  encryptresponseData,
  DecryptTruthScreenResponse,
} = require("./api/TruthScreenTestController/TestTruthScreen.controller");
const clientValidation = require("./middleware/ClientValidation.middleware");
const {
  decryptMiddleware,
  encryptMiddleware,
} = require("./middleware/decryptPayload");
const {
  decryptPayload,
  encryptPayload,
} = require("./middleware/clientDecryptPayload");
const { connectDB } = require("./config/db.config");
const { WalletApiroutes } = require("./api/WalletTopup/Routes.js/WalletRoutes");

const app = express();
const port = process.env.PORT;

const server = http.createServer(app);

/*
====================================================
SOCKET.IO INIT
====================================================
*/
const io = new Server(server, {
  cors: {
    origin: "*", // change in production
    methods: ["GET", "POST"],
  },
});

/*
====================================================
SOCKET EVENTS
====================================================
*/
io.on("connection", (socket) => {
  console.log("🔌 Socket Connected:", socket.id);

  socket.on("join_order_room", (orderId) => {
    console.log(`📦 ${socket.id} joined room ${orderId}`);
    socket.join(orderId);
  });

  socket.on("leave_order_room", (orderId) => {
    socket.leave(orderId);
    console.log(`🚪 ${socket.id} left room ${orderId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket Disconnected:", socket.id);
  });
});

/*
====================================================
MAKE io AVAILABLE IN ROUTES / CONTROLLERS
====================================================
*/
app.set("io", io);

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

app.use(
  cors({
    origin: "*",
  }),
);

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

const uatdatabase = {
  host: process.env.MONGODB_HOST_UAT,
  port: process.env.MONGODB_PORT_UAT,
  db: process.env.MONGODB_DB_UAT,
  user: process.env.MONGODB_USERNAME_UAT,
  pass: process.env.MONGODB_PASSWORD_UAT,
};
const database = {
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
  mongoURI = `mongodb://${uatdatabase.user}:${uatdatabase.pass}@${uatdatabase.host}:${uatdatabase.port}/${uatdatabase.db}?authSource=admin`;
  console.log("connected to uat data base ====>>>");
}

connectDB(mongoURI);

// ================== Check Server is running ==================
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date(),
    message: "MicroService Kyc Health check",
  });
});

// ================== Public/Open Routes ==================
// These routes do NOT need encryption, key validation, or whitelisting

app.use("/kyc/api/v1/ApiModuels", WalletApiroutes);

const serverMiddleware = [clientValidation, decryptPayload, encryptPayload];
// const server = [decryptPayload, encryptPayload];
const serverSkippedMiddleware = [clientValidation];
const clientMiddleware = [
  clientValidation,
  decryptMiddleware,
  encryptMiddleware,
];

// Use Main Routes
app.use("/kyc/api/v1/internal", ...serverMiddleware, mainRoutes); // SERVER TO SERVER
app.use("/kyc/api/v1", mainRoutes); // SERVER TO SERVER
app.use("/kyc/api", ...serverSkippedMiddleware, mainRoutes); // SERVER TO SERVER
app.use("/kyc/client", ...serverSkippedMiddleware, mainRoutes); // SERVER TO SERVER
app.use("/kyc/api/v1/client", ...clientMiddleware, mainRoutes); // FRONTEND TO SERVER

// ================== FOR TruthScreen Testing ==================
app.post("/kyc/TruthScreen/Encryption", encryptresponseData);
app.post("/kyc/TruthScreen/Decryption", DecryptTruthScreenResponse);

app.use(exceptionHandling.GlobalExceptionHandling);

server.listen(port, (err) => {
  if (err) {
    console.log("Server connection Failed");
    return;
  }

  console.log(`Server + Socket running on ${port}`);
});
