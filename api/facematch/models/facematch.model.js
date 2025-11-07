const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let face_Match = new Schema(
  {
    adhaarimage: { type: String, required: true },
    aadharNumber: {type: String}, // added by vishnu
    userimage: { type: String, required: true },
    response: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now },
    token: {
      type: String,
      required: false
    },
    MerchantId: {
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

// Export the model
module.exports = mongoose.model("face_Match", face_Match);
