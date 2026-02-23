const chargesToBeDebited = require("../utils/chargesMaintainance");
const creditsToBeDebited = require("../utils/creditsMaintainance");
const { commonLogger } = require("../api/Logger/logger");


const deductCredits = async (clientId, serviceId, categoryId, tnId, environment) => {
    try {
        commonLogger.info(`Deducting credits for client: ${clientId}, service: ${serviceId}, env: ${environment}`);
        let maintainanceResponse;
        if (environment?.toLowerCase() === "test") {
            maintainanceResponse = await creditsToBeDebited(
                clientId,
                serviceId,
                categoryId,
                tnId
            );
        } else {
            maintainanceResponse = await chargesToBeDebited(
                clientId,
                serviceId,
                categoryId,
                tnId
            );
        }

        if (maintainanceResponse?.result) {
            commonLogger.info(`Successfully deducted credits for client: ${clientId}, txnId: ${tnId}`);
        } else {
            commonLogger.warn(`Failed to deduct credits for client: ${clientId}, txnId: ${tnId}. Response: ${JSON.stringify(maintainanceResponse)}`);
        }

        return maintainanceResponse;
    } catch (error) {
        commonLogger.error(`Error in deductCredits service for client ${clientId}: ${error.message}`, error);
        return {
            result: false,
            message: "Credit deduction failed",
            error: error.message
        };
    }
};

module.exports = {
    deductCredits
};
