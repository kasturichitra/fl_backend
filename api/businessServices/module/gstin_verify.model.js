const mongoose = require("mongoose");

const Gstin_details = new mongoose.Schema(
  {
    gstinNumber: {
      type: String,
      required: true,
    },
    status: {
      type: Number,
    },
    response: { type: Object },
    serviceResponse: { type: Object },
    message: { type: String },
    mobileNumber: { type: String },
    serviceName: { type: String },
  },
  {
    timestamps: true,
  },
);

// Export the model
module.exports = mongoose.model("Gstin_details", Gstin_details);
