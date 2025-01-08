const mongoose = require("mongoose");

const verify_holderName = new mongoose.Schema({
  token: {
    type: String,
  },
  MerchantId: {
    type: String,
  },
  accountHolderName: {
    type: String
  },
  panHolderName:{
    type : String
  },
  verificationName:{
    type:String
  },
  accountNo: {
    type: String
  },
  accountIFSCCode: {
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
module.exports = mongoose.model("verify_holderName", verify_holderName);
