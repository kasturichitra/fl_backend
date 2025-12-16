const mongoose = require("mongoose");

const panAadhaarDetails = new mongoose.Schema({
  panNumber: {
    type: String,
  },
  aadhaarNumber:{
    type: Object,
  },
  serviceResponse:{
    type: Object,
  },
  serviceName:{
    type: String
  },
  userName: {
    type: String,
    required: false
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
  }
);

module.exports = mongoose.model("pan_To_Aadhaar", panAadhaarDetails);
