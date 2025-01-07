const mongoose = require("mongoose");

const AdhaarSchema = new mongoose.Schema({
  token: {
    type: String,
    required: false
  },
  aadharNumber: {
    type: String,
    required: false
  },
  aadharImage: {
    type: String,
    required: false
  },
  request_id: {
    type: String,
    required: false
  },
  taskId: {
    type: String,
    required: false
  },
  response: {
    type: Object,
    required: false
  },
  MerchantId: {
    type: String,
  },
  aadharName:{
    type:String
  },
  city:{
    type:String
  },
  state:{
    type:String
  },
  location:{
    type:String
  },
  district:{
    type:String
  },
  subDistrict:{
    type:String
  },
  street:{
    type:String
  },
  landMark:{
    type:String
  },
  houseNo:{
    type:String
  },
  pinCode:{
    type:String
  },
  dateOfBirth:{
    type:String
  },
  gender:{
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
});



const aadhaar = mongoose.model("Adhaar_details", AdhaarSchema); 

module.exports = aadhaar