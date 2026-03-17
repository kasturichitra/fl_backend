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
    result: { type: Object },
    message: { type: String },
    responseOfService: { type: Object },
    service: { type: String },
  },
  {
    timestamps: true,
  },
);

// Export the model
module.exports = mongoose.model("Gstin_pandetails", Gstin_pandetails);
