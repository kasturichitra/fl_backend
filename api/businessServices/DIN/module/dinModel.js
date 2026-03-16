
const mongoose = require('mongoose');

const dinVerification = new mongoose.Schema({
    dinNumber:{
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

module.exports = mongoose.model("din_Verification", dinVerification);

