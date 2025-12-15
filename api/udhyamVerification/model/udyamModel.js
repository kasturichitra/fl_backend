const mongoose = require("mongoose");

const udyamVerificationSchema = new mongoose.Schema(
  {
    udyamNumber: {
      type: String,
      unique: true
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
  "udyamVerification",
  udyamVerificationSchema
);

module.exports = udhyamVerify;
