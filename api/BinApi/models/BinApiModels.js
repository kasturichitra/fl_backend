const mongoose = require("mongoose");

const RapidBinModel = mongoose.Schema(
  {
    bin: {
      type: String,
    },
    response: {
      type: Object,
    },
    status: {
      type: Number,
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
  { timestamps: true }
);

module.exports = mongoose.model("binCardValidation", RapidBinModel);
