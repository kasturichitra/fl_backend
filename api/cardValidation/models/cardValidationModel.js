const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let cardValidationSchema = new Schema(
  {
    cardNumber: {
      type: String,
      required: true,
    },
    response: { type: Object, required: true },
    status: {
      type: Number,
    },
    serviceResponse: {
      type: Object,
    },
    serviceId: {
      type: String,
    },
     serviceName: {
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

module.exports = mongoose.model("card_validation", cardValidationSchema);
