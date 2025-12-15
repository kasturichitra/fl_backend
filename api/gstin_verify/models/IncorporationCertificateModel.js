const mongoose = require("mongoose");

const IncorporationCertificate = new mongoose.Schema(
  {
    cinNumber: {
      type: String,
      required: true,
    },
    response: {
      type: Object,
      required: true,
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

module.exports = mongoose.model(
  "incorporationCertificate",
  IncorporationCertificate
);
