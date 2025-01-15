const mongoose = require("mongoose");

const panDobDetails = new mongoose.Schema({
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

module.exports = mongoose.model("panDobDetails", panDobDetails);
