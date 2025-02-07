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
    gender:{
      type:String
    },
    ipAddress: {
      type: [],
      default: null,
    },
    companyName: {
      type: String,
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
