const mongoose = require("mongoose")

const bbpsintegration = new mongoose.Schema({
  billerId: {
    type: String,
  },
  requestId:{
  type: String
  },
  requestBody: { type: Object },
  responseBody: { type: Object },
  responseStatus: { type: String },
  jsonData: {
    type: mongoose.Schema.Types.Mixed,
  },
  createdAt: { type: Date, default: Date.now },
},
  {
    timestamps: true,
  })
module.exports = mongoose.model("bbps_integration", bbpsintegration);
  
