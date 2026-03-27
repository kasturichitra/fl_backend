const mongoose = require("mongoose");

const IncorporationCertificate = new mongoose.Schema(
  {
    cinNumber: {
      type: String,
      required: true,
      unique: true 
    },
    response: {
      type: Object,
      required: true,
    },
    status: {
      type: Number,
    },
    mobileNumber: { type: String },
    serviceResponse: {
      type: Object,
    },
    serviceName: {
      type: String,
    },
    createdTime: {
      type: String,
    },
    createdDate: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model(
  "incorporationCertificate",
  IncorporationCertificate,
);
