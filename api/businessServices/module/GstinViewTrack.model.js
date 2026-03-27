const mongoose = require('mongoose');

const gstinViewTrack = new mongoose.Schema({
    gstinNumber: {
      type: String,
      required: true,
    },
    Financialyear:{
      type:String
    },
    mobileNumber: { type: String },
    status: {
      type: Number,
    },
    response: { type: Object },
    message: { type: String },
    serviceResponse: { type: Object },
    service: { type: String },
},{timestamps: true});

module.exports = mongoose.model('gstinViewTracking',gstinViewTrack);