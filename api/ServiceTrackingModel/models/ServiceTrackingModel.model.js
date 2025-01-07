const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let serviceTrackingModel = new Schema(
  {
    serviceName: {
      type: String,
    },
    serviceFor: {
      type: String,
    },
    serviceClientId: {
      type: String,
      // required: true,
      default: "",
    },
    serviceSecretKey: {
      type: String,
    },
    serviceStatus: {
      type: String,
      enum: ["Active", "DeActive"],
    },
    serviceType: {
      type: String,
    },
    createdDate: {
      type: String,
    },
    limit: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("serviceTrackingModel", serviceTrackingModel);
