const mongoose = require("mongoose");

const panDobDetails = new mongoose.Schema({
  panNumber: {
    type: String,
  },
  responseData: {
    type: Object,
  },
  token: {
    type: String,
    required: false
  },
  result:{
    type : String,
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
