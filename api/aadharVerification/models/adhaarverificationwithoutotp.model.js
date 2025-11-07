const mongoose = require("mongoose");

const Adhaardetails = new mongoose.Schema({
  aadhaarNumber: {
    type: String, 
  },
  response: {
    type: Object, 
  },
    message: {
      type: String,
    
      
    },
    success: {
      type: Boolean,
    
    },
 
},
{
  timestamps: true,
});

const aadhaar = mongoose.model("Adhaardetailswithout_otp", Adhaardetails); 

module.exports = aadhaar