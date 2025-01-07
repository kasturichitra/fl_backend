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
      type: Number,
    },
    createdTime: {
      type: Date,
      default: Date.now,
    },
    createdDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const loginAndSms = mongoose.model("loginAndSms", smsSchema);

module.exports = loginAndSms;
