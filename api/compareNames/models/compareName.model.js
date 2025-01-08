const mongoose = require("mongoose");

const verify_names = new mongoose.Schema({

  token: {
    type: String,

  },
  MerchantId: {
    type: String,

  },
  firstName: {
    type: String
  },
  secondName: {
    type: String
  },
  responseData: {
    type: Object,
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

// Export the model
module.exports = mongoose.model("verify_names", verify_names);
