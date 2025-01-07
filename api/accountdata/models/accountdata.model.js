const mongoose = require("mongoose");

const verify_accountdata = new mongoose.Schema({

  token: {
    type: String,

  },
  MerchantId: {
    type: String,

  },
  accountHolderName: {
    type: String
  },
  accountNo: {
    type: String
  },
  accountIFSCCode: {
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

// Export the model
//server.tenantDB.model("users", users);
module.exports = mongoose.model("verify_accountdata", verify_accountdata);
