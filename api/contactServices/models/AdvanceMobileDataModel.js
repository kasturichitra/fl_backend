const mongoose = require("mongoose");

const advanceMobileData = new mongoose.Schema(
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
    transaction_id: {
      type: String,
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
  },
);

module.exports = mongoose.model("advanceMobileData", advanceMobileData);
