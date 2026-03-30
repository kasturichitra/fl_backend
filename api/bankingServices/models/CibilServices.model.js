const mongoose = require('mongoose');

const cibilServiceModel = new mongoose.Schema({
    panNumber:{
        type:String,
        require:true
    },
    customerName:{
        type:String,
        require:true
    },
    customerMobile:{
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
  },{timestamps: true});

module.exports = mongoose.model("CibilModel", cibilServiceModel);

