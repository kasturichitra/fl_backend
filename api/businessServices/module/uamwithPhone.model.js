
const mongoose = require('mongoose');

const uamPhoneVerification = new mongoose.Schema({
    UAMNumber:{
        type:String,
        require:true
    },
    customerNumber:{
        type:String,
        require:true
    },
    mobileNumber: { type: String },
    status: {
      type: Number,
    },
    response: { type: Object },
    serviceResponse: { type: Object },
    serviceName: { type: String },
    createdDate:{type:String},
    createdTime:{type:String}
  },
  {
    timestamps: true,
  });

module.exports = mongoose.model("uamPhone_Verification", uamPhoneVerification);

