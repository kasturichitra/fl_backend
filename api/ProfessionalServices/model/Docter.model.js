const mongoose = require('mongoose');

const DocterVerificationModel = new mongoose.Schema({
    RegistrationNumber:{type:String, require:true},
    state:{type:String, require:true},
    mobileNumber: { type: String },
    status: {type: Number},
    response: { type: Object },
    serviceResponse: { type: Object },
    serviceName: { type: String },
    createdDate:{type:String},
    createdTime:{type:String}
},{timestamps:true});

module.exports = mongoose.model('DocterVerification',DocterVerificationModel)
