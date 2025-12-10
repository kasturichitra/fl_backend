const mongoose = require("mongoose");

const udhyamVerificationSchema = new mongoose.Schema(
  {
    udhyamNumber: {
      type: String,
    },
    response: {
      type: Object,
    },
    serviceName: {
      type: String,
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
    createdTime: {
      type: String,
    },
    createdDate: {
      type: String,
    },
  },
  { timestamps: true }
);

const udhyamVerify = mongoose.model(
  "udhyamVerification",
  udhyamVerificationSchema
);

module.exports = udhyamVerify;
