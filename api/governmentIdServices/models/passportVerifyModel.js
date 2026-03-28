const mongoose = require("mongoose");

const passportDetails = new mongoose.Schema(
  {
    passportFileNo: {
      type: String,
    },
    surname: {
      type: String,
    },
    firstName: {
      type: String,
    },
    gender: {
      type: String,
    },
    countryCode: {
      type: String,
    },
    dateOfBirth: {
      type: String,
    },
    passportType: {
      type: String,
    },
    dateOfExpiry: {
      type: String,
    },
    mrz1: {
      type: String,
    },
    mrz2: {
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
  }
);

module.exports = mongoose.model("passportVerification", passportDetails);