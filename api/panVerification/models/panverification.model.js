const mongoose = require("mongoose");

const panDetails = new mongoose.Schema({
  panNumber: {
    type: String,
  },
  response: {
    type: Object,
    required: true
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

module.exports = mongoose.model("panDetails", panDetails);
