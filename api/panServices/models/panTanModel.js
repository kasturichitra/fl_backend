const mongoose = require("mongoose");

const panTanVerify = new mongoose.Schema(
  {
    panNumber: {
      type: String,
    },
    tanNumber: {
      type: String,
    },
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
    userName: {
      type: String,
      required: false,
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

module.exports = mongoose.model("panTanVerification", panTanVerify);
