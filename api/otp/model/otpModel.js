const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: Number,
    },
    response: {
      type: Object,
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

const mobile = mongoose.model("mobileVerification", otpSchema);

module.exports = mobile;
