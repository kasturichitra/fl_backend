const mongoose = require("mongoose");

const courtRecordSchema = new mongoose.Schema({
  recordName:{
    type: String,
  },
  address:{
    type: String,
  },
  mobileNumber: {
    type: String,
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

module.exports = mongoose.model("courtRecord", courtRecordSchema);
