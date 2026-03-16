const mongoose = require("mongoose");

const panNameDob = new mongoose.Schema({
  panNumber: {
    type: String,
  },
  fullName: {
    type: String,
  },
  dateOfBirth:{
    type:String
  },
   mobileNumber:{
    type: Number,
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

module.exports = mongoose.model("panNameDob", panNameDob);
