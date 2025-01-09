const mongoose = require("mongoose");

const smsSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: Number,
    },
    token: {
      type: String,
    },
    merchantId: {
      type: String,
    },
    otp: {
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

const loginAndSms = mongoose.model("loginAndSms", smsSchema);

module.exports = loginAndSms;
