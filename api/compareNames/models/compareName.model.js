const mongoose = require("mongoose");

const verify_names = new mongoose.Schema({
  firstName: {
    type: String
  },
  secondName: {
    type: String
  },
  responseData: {
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

module.exports = mongoose.model("verify_names", verify_names);
