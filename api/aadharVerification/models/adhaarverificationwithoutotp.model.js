const mongoose = require("mongoose");

const Adhaardetails = new mongoose.Schema(
  {
    aadhaarNumber: {
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
      type: Number,
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

const aadhaar = mongoose.model("Adhaardetailswithout_otp", Adhaardetails);

module.exports = aadhaar;
