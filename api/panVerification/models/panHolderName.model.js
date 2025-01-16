const mongoose = require("mongoose");

const panHolderDetails = new mongoose.Schema({
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
  verificationName:{
    type:String
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

module.exports = mongoose.model("panHolderDetails", panHolderDetails);
