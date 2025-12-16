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
    panNumber: {
      type: String,
      required: true,
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
    image: {
      type: String,
    },
    companyDetails: {
      businessName: {
        type: String,
      },
      addressLine1: {
        type: String,
      },
      addressLine2:{
        type: String,
      },
      cityState: {
        type: String,
      },
    },
    companyKYC:{
      type:Object
    },
    IndividualKYC:{ 
      type:Object
    },
    walletStatus: {
      type: String,
      enum: ['DeActive', 'Active'],
      default: 'DeActive'
    },
    role: {
      type: String,
      default: "user"
    },
    gender: {
      type: String
    },
    companyName: {
      type: String,
    },
    kycCompleted: {
      type: Boolean,
      default: false
    },
    IskycApproved: {
      type: Boolean,
      default: false
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
