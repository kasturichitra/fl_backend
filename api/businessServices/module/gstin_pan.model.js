const mongoose = require("mongoose");

const Gstin_pandetails = new mongoose.Schema(
  {
    gstinNumber: {
      type: String,
      required: true,
    },
    panNumber: {
      type: String,
      required: true,
    },
    mobileNumber: { type: String },
    status: {
      type: Number,
    },
    response: { type: Object },
    message: { type: String },
    serviceResponse: { type: Object },
    service: { type: String },
  },
  {
    timestamps: true,
  },
);

// Export the model
module.exports = mongoose.model("Gstin_pandetails", Gstin_pandetails);
