const mongoose = require("mongoose");

const AdhaarSchema = new mongoose.Schema({
    trans_id: {
      type: String,
    },
    ts_trans_id: {
      type: String,
    },
    link: {
      type: String,
    },
    status: {
      type: String,
    },
    aadhaarDetails: {
      name: { type: String},
      fatherName: { type: String},
      dob: { type: String},
      aadhar_number: { type: String},
      gender: { type: String},
      address: { type: String},
      co: { type: String},
      photo: { type: String},
    },
    response: {
      type: Object,
      default: {},
    },
 
 
},
{
  timestamps: true,
});



const aadhaar = mongoose.model("Adhaardetailswith_opt", AdhaarSchema); 

module.exports = aadhaar