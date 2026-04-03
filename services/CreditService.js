const chargesToBeDebited = require("../utils/chargesMaintainance");
const creditsToBeDebited = require("../utils/creditsMaintainance");


const deductCredits = async (clientId, serviceId, categoryId, tnId, req, logger) => {
    const environment = req.environment
    try {
        logger.info(`Deducting credits for client: ${clientId}, service: ${serviceId}, env: ${environment}`);
        let maintainanceResponse;
        if (environment?.toLowerCase() === "test") {
            maintainanceResponse = await creditsToBeDebited(
                clientId,
                serviceId,
                categoryId,
                tnId,
                req,
                logger
            );
        } else {
            maintainanceResponse = await chargesToBeDebited(
                clientId,
                serviceId,
                categoryId,
                tnId,
                req,
                logger
            );
        }

        if (maintainanceResponse?.result) {
            logger.info(`Successfully deducted credits for client: ${clientId}, txnId: ${tnId}`);
        } else {
            logger.info(`Failed to deduct credits for client: ${clientId}, txnId: ${tnId}. Response: ${JSON.stringify(maintainanceResponse)}`);
        }

        return maintainanceResponse;
    } catch (error) {
        logger.error(`Error in deductCredits service for client ${clientId}: ${error.message}`, error);
        return {
            result: false,
            message: error?.response?.data.message || "Credit deduction failed",
            error: error.message
        };
    }
};

module.exports = {
    deductCredits
};
