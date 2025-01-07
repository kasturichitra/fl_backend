const mongoose = require("mongoose");

const IncorporationCertificate = new mongoose.Schema({
    cinNumber: {
        type: String,
        required: true
    },
    response: {
        type: Object,
        required: true
    },
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
    });


// Export the model
module.exports = mongoose.model("incorporationCertificate", IncorporationCertificate); 