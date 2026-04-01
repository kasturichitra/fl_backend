const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    fileHash: {
      type: String,
      required: true,
    },
    serviceKey: {
      type: String,
      required: true,
    },
    mobileNumber: {
      type: String,
      default: "",
    },
    response: {
      type: Object,
      default: {},
    },
    status: {
      type: Number, // 1 success, 2 failure
      enum: [1, 2],
      default: 2,
    },
    serviceName: {
      type: String,
      default: "",
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
  { timestamps: true },
);

// Unique cache per service
imageSchema.index({ fileHash: 1, serviceKey: 1 }, { unique: true });

module.exports = mongoose.model("ImageVerification", imageSchema);
