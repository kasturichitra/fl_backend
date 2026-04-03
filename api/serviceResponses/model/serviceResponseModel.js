const mongoose = require("mongoose");

const responseSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      index: true
    },
    TxnID:{
      type:String,
      required: true,
    },
    categoryId: {
      type: String,
      required: true,
      index: true
    },
    serviceId: {
      type: String,
      required: true,
      index: true
    },
    createdDate: {
      type: String
    },
    createdTime: {
      type: String
    },
    result: {
      type: Object,
      required: true
    }
  },
  { timestamps: true }
);


// 🔥 Compound Index (MOST IMPORTANT)
responseSchema.index({ clientId: 1, serviceId: 1, categoryId: 1 });

// 🔥 For fetching recent records fast
responseSchema.index({ createdAt: -1 });

// 🔥 For client history sorted by latest
responseSchema.index({ clientId: 1, createdAt: -1 });

const responseModel = mongoose.model("serviceResponse", responseSchema);

module.exports = responseModel;
