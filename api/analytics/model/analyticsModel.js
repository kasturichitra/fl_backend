const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema({
  clientId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  services: [
    {
      service: { type: String, required: true },
      category: { type: String, required: true },
      count: { type: Number, default: 0 }
    }
  ]
}, { timestamps: true });

const analyticsModel = mongoose.model("analyticsData", analyticsSchema);

module.exports = analyticsModel;
