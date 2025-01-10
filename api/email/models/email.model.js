const mongoose = require("mongoose");

const email_verify = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  mobileNumber: {
    type: String,
  },
  token: {
    type: String,
    required: true
  },
  MerchantId: {
    type: Object,
  
  },
},
  {
    timestamps: true,
  }
);

// Export the model
module.exports = mongoose.model("email_verify", email_verify);
