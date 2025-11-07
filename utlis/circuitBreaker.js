const ServiceTrackingModel = require("../api/ServiceTrackingModel/models/newServiceTrackingModel.js");

async function recordFailure(service) {
    const today = new Date().toISOString().split("T")[0];
    const todayLog = service.serviceErrorCount.find(entry => entry.date === today);

    if (todayLog) {
        // updating erro count 
        const newCount = todayLog.errorCount + 1;
        const update = {
            $set: { "serviceErrorCount.$.errorCount": newCount }
        };

        if (newCount >= service.thresholdValue) {
            update.$set["serviceErrorCount.$.frozenUntil"] = new Date(Date.now() + 5 * 60 * 1000);
            console.log(`🚨 ${service.serviceFor}-${service.serviceName} frozen for 5 mins`);
        }

        await ServiceTrackingModel.updateOne(
            { _id: service._id, "serviceErrorCount.date": today },
            update
        );

    } else {
        // updated new date
        const errorData = {
            date: today,
            errorCount: 1,
            frozenUntil: null
        };

        await ServiceTrackingModel.updateOne(
            { _id: service._id },
            {
                $push: {
                    serviceErrorCount: {
                        $each: [errorData],
                        $slice: -7 
                    }
                }
            }
        );

        console.log(`New day error count started for ${service.serviceFor}-${service.serviceName}`);
    }
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
