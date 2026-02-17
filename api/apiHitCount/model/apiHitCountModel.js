const mongoose = require("mongoose");

const apiHitCountSchema = new mongoose.Schema(
  {
    identifiers: {
      type: Object,
      required: true,
    },
    service: {
      type: String,
      required: true,
    },
     category: {
      type: String,
      required: true,
    },
    clientId: {
      type: String,
      required: true,
    },
    dayHitCount: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

apiHitCountSchema.index({
  clientId: 1,
  service: 1,
  category: 1,
  identifiers: 1,
  createdAt: 1
});

module.exports = mongoose.model("apiHitCount", apiHitCountSchema);
