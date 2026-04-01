const mongoose = require("mongoose");
const { commonLogger } = require("../api/Logger/logger");

exports.connectDB = async (mongoURI) => {
  try {
    commonLogger.info(`Connecting to the MongoDB...`)
    await mongoose.connect(mongoURI);
    commonLogger.info(`DB Connected Successfully`)
  } catch (err) {
    console.error("DB Connection Failed:", err.message);
    commonLogger.info('DB Connection Failed ERROR_MESSAGE:',err.message)
  }
};