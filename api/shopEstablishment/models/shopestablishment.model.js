const mongoose = require("mongoose");

const shop_establishment = new mongoose.Schema({
 
  registrationNumber: {
    type: String,
    required: true
  },
  response: {
    type: Object,
    required: true
  },
  MerchantId: {
    type: Object,
  },
  token: {
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
  state:{
    type:String
  },
  nameOfTheShop:{
    type:String
  }
  },
  {
    timestamps: true,
  }
);

// Export the model
module.exports = mongoose.model("shop_establishment", shop_establishment);
