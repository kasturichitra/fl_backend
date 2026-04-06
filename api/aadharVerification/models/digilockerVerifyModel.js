const mongoose = require("mongoose");

const digilockerDetails = new mongoose.Schema(
  {
    mobileNumber: {
      type: String,
    },
    response: {
      type: Object,
    },
    serviceResponse: {
      type: Object,
    },
    status: {
      type: Number,
    },
    serviceName: {
      type: String,
    },
    createdTime: {
      type: String,
      default: Date.now,
    },
    createdDate: {
      type: String,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const digilockerverify = mongoose.model(
  "digilockerverification",
  digilockerDetails,
);

module.exports = digilockerverify;
