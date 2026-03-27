const mongoose = require("mongoose");

const electricityBillDetails = new mongoose.Schema(
  {
    passportFileNo: {
      type: String,
    },
    dateOfBirth: {
      type: String,
    },
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

module.exports = mongoose.model("electricityBill", electricityBillDetails);
