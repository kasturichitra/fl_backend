const mongoose = require('mongoose');

const InsuranceModel = new mongoose.Schema({
    PanNumber:{type:String, require:true},
    mobileNumber: { type: String },
    status: {type: Number},
    response: { type: Object },
    serviceResponse: { type: Object },
    serviceName: { type: String },
    createdDate:{type:String},
    createdTime:{type:String}
},{timestamps:true});

module.exports = mongoose.model('InsuranceVerification',InsuranceModel)

