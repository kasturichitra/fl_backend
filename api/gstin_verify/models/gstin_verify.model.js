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
module.exports = mongoose.model("Gstin_details", Gstin_details);
