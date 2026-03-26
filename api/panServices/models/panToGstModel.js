const mongoose = require("mongoose");

const panToGstDetails = new mongoose.Schema({
  panNumber: {
    type: String,
  },
  response: {
    type: Object,
  },
  serviceResponse:{
    type: Object,
  },
   mobileNumber:{
    type: Number,
  },
  status:{
    type: Number,
  },
  serviceName:{
    type: String
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

module.exports = mongoose.model("panToGstDetails", panToGstDetails);
