const mongoose = require("mongoose");

const ServiceErrorSchema = new mongoose.Schema({
    date: { type: String },
    errorCount: { type: Number, default: 0 },
    frozenUntil: { type: Date, default: null }
});
const ServiceTrackingSchema = new mongoose.Schema({
    serviceFor: { type: String, required: true },
    serviceName: { type: String, required: true },
    serviceStatus: { type: String, enum: ["Active", "Default", "DeActive"], default: "Default" },
    servicePriority: { type: Number, required: true },
    thresholdValue: { type: Number, required: true },
    serviceErrorCount: { type: [ServiceErrorSchema], default:[]}
}, { timestamps: true });

module.exports = mongoose.model("serviceTrackingModel", ServiceTrackingSchema);