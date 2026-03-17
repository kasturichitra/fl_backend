const mongoose = require('mongoose');

const gstInTaxpayer = new mongoose.Schema(
    {
    gstinNumber: {
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
module.exports = mongoose.model("gstInTaxpayer", gstInTaxpayer);