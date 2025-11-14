// const ServiceTrackingModel = require("../models/ServiceTrackingModel");
const ServiceTrackingModel = require("../ServiceTrackingModel/models/newServiceTrackingModel.js");
const circuitBreaker = require("../../utlis/circuitBreaker.js");

async function selectService(serviceName) {
    const FinalService = await ServiceTrackingModel.aggregate([
        {
            $match: { serviceName }
        },
        {
            $addFields: {
                latestError: { $last: "$serviceErrorCount" }
            }
        },
        {
            $addFields: {
                statusOrder: {
                    $switch: {
                        branches: [
                            { case: { $eq: ["$serviceStatus", "Active"] }, then: 0 },
                            { case: { $eq: ["$serviceStatus", "Default"] }, then: 1 }
                        ],
                        default: 2
                    }
                },
                isFrozen: {
                    $cond: [
                        {
                            $and: [
                                "$latestError.frozenUntil",
                                { $gt: ["$latestError.frozenUntil", new Date()] }
                            ]
                        },
                        1,
                        0
                    ]
                }
            }
        },
        {
            $match: { isFrozen: 0 }
        },
        {
            $sort: { statusOrder: 1, servicePriority: 1 }
        },
        { $limit: 1 }
    ]);

    console.log("Final selected service =>", FinalService);
    return FinalService[0] || null;
}


async function updateFailure(service) {
    await circuitBreaker.recordFailure(service);
};

async function resetSuccess(service) {
    await circuitBreaker.resetSuccess(service);
};

module.exports = { selectService, updateFailure, resetSuccess };
