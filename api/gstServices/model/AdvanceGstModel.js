const mongoose = require('mongoose');

const advanceGstModel = new mongoose.Schema({
    gstNo:{type:String, require:true},
    year:{type:String, require:true},
    mobileNumber: { type: String },
    status: {type: Number},
    response: { type: Object },
    serviceResponse: { type: Object },
    serviceName: { type: String },
    createdDate:{type:String},
    createdTime:{type:String}
},{timestamps:true});

module.exports = mongoose.model('advanceGstModel',advanceGstModel);

