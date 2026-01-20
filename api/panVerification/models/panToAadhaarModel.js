const mongoose = require("mongoose");

const panAadhaarDetails = new mongoose.Schema(
  {
    panNumber: {
      type: String,
    },
    response: {
      type: Object,
      required: true,
    },
    aadhaarNumber: {
      type: Object,
    },
    status: {
      type: Number,
    },
    serviceId: {
      type: String,
    },
    serviceResponse: {
      type: Object,
    },
    serviceName: {
      type: String,
    },
    userName: {
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
  }
);

module.exports = mongoose.model("pan_To_Aadhaar", panAadhaarDetails);
