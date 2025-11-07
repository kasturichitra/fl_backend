const ServiceTrackingModel = require("../api/ServiceTrackingModel/models/newServiceTrackingModel.js");

async function recordFailure(service) {
    const today = new Date().toISOString().split("T")[0];
    const errorData = service.serviceErrorCount || { date: today, errorCount: 0 };

    if (errorData.date !== today) {
        errorData.date = today;
        errorData.errorCount = 0;
    }

    errorData.errorCount += 1;

    if (errorData.errorCount >= service.thresholdValue) {
        errorData.frozenUntil = new Date(Date.now() + 5 * 60 * 1000); // freeze 5 mins
        console.log(`🚨 ${service.serviceFor}-${service.serviceName} frozen`);
    }

    await ServiceTrackingModel.updateOne(
        { _id: service._id },
        { serviceErrorCount: errorData }
    );
}

async function resetSuccess(service) {
    await ServiceTrackingModel.updateOne(
        { _id: service._id },
        {
            $set: {
                "serviceErrorCount.date": new Date().toISOString().split("T")[0],
                "serviceErrorCount.errorCount": 0,
                "serviceErrorCount.frozenUntil": null
            }
        }
    );
}

module.exports = { recordFailure, resetSuccess };
