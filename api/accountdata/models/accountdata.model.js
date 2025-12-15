const mongoose = require("mongoose");

const verify_accountdata = new mongoose.Schema(
  {
    accountHolderName: {
      type: String,
    },
    accountNo: {
      type: String,
    },
    accountIFSCCode: {
      type: String,
    },
    serviceResponse: {
      type: Object,
    },
    status: {
      type: Number,
    },
    serviceId: {
      type: String,
    },
    responseData: {
      type: Object,
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

module.exports = mongoose.model("verify_accountdata", verify_accountdata);
