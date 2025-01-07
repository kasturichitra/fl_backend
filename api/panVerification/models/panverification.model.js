const mongoose = require("mongoose");

const panDetails = new mongoose.Schema({
  panNumber: {
    type: String,
  },
  response: {
    type: Object,
    required: true
  },
  token: {
    type: String,
    required: false
  },
  userName: {
    type: String,
    required: false
  },
  MerchantId: {
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

module.exports = mongoose.model("panDetails", panDetails);
