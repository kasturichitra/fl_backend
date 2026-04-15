const mongoose = require("mongoose");

const walletTopup = new mongoose.Schema(
  {
    clientID:{
        type: String,
    },
    type: {
      type: String,
      enum: ["TOKEN", "STATIC_QR", "DYNAMIC_QR"],
    },
    accessToken: {
      type: String,
    },
    tokenType: {
      type: String,
    },
    expiresIn: {
      type: Number,
      min: 0,
    },
    clientId: {
      type: String,
    },
    merchantId: {
      type: String,
    },
    amount: {
      type: Number,
    },
    orderId: {
      type: String,
    },
     payeeAddress: {
      type: String,
    },
    payeeName: {
      type: String,
    },
    qrCode: {
      type: String,
    },
    geo_code: {
      type: String,
    },
    geo_location: {
      type: String,
    },
    status: {
      type: String,
    },
    rawResponse: {
      type: Object,
    },
    createdAt:{
        type:String
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Wallet", walletTopup);
