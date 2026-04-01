const mongoose = require("mongoose");

const chequeClassification = new mongoose.Schema(
  {
    mobileNumber: {
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
      type: String,
    },
    createdDate: {
      type: String,
      default: Date.now,
    },
    createdTime: {
      type: String,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("chequeClassification", chequeClassification);
