const mongoose = require("mongoose");

const digiPinToLongLatDetails = new mongoose.Schema({
  digiPin: {
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
  serviceId:{
    type: String,
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

module.exports = mongoose.model("digiPinToLongLat", digiPinToLongLatDetails);
