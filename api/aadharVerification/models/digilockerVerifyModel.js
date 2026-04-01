const mongoose = require("mongoose");

const digilockerDetails = new mongoose.Schema(
  {
    mobileNumber: {
      type: String,
    },
    response: {
      type: Object,
    },
    status: {
      type: Number,
    },
    serviceName: {
      type: Number,
    },
    message: {
      type: String,
    },
    success: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
  },
);

const digilockerverify = mongoose.model("digilockerverification", digilockerDetails);

module.exports = digilockerverify;
