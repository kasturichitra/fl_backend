const mongoose = require("mongoose");

const Gstin_details = new mongoose.Schema({
  gstinNumber: {
    type: String,
    required: true
  },
  response: {
    type: Object,
    required: true
  },
  companyName: {
    type: String
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
  });


// Export the model
module.exports = mongoose.model("Gstin_details", Gstin_details); 