const mongoose = require("mongooose");

const apiHitCountSchema = new mongoose.Schema(
  {
    service: {
      type: String,
    },
    value: {
      type: String,
    },
    dayHitCount: {
      type: String,
    },
    monthHitCount: {
      type: Object,
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

module.exports = mongoose.model("apiHitCount", apiHitCountSchema);
