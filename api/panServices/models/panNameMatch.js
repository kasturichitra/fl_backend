const mongoose = require("mongoose");

const panNameMatch = new mongoose.Schema({
  panNumber: {
    type: String,
  },
  nameToMatch:{
    type:String
  },
  response: {
    type: Object,
  },
  serviceResponse:{
    type: Object,
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

module.exports = mongoose.model("panNameMatch", panNameMatch);
