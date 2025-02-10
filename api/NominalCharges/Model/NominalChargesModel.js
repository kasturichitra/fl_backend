const mongoose = require("mongoose")
const NominalChargesSchema = mongoose.Schema({
    service: {
        type: String
    },
    chargeFee: {
        type: String
    },
    chargePercentage: {
        type: String
    },
    createdDate: {
        type: String
    },
    createdTime: {
        type: String
    }

}, { timestamps: true })

module.exports = mongoose.model('NominalCharges', NominalChargesSchema);