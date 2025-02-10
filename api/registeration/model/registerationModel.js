const mongoose = require("mongoose");

const registerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    mobileNumber: {
      type: Number,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    merchantId: {
      type: String,
      required: true,
      unique: true,
    },
    role:{
      type:String,
      default:"user"
    },
    gender:{
      type:String
    },
    companyName: {
      type: String,
    },
    kycCompleted:{
      type:Boolean,
      default:false
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

const registeration = mongoose.model("registeredUsers", registerSchema);

module.exports = registeration;
