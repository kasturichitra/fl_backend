const chargesToBeDebited = require("../utils/chargesMaintainance");
const creditsToBeDebited = require("../utils/creditsMaintainance");


const deductCredits = async (clientId, serviceId, categoryId, TxnID, req,logger) => {
    const environment = req.environment
    try {
        logger.info(`Deducting credits for client: ${clientId},txnId: ${TxnID} service: ${serviceId}, env: ${environment}`);
        let maintainanceResponse;
        if (environment?.toLowerCase() === "test") {
            maintainanceResponse = await creditsToBeDebited(
                clientId,
                serviceId,
                categoryId,
                req,
                TxnID,
                logger
            );
        } else {
            maintainanceResponse = await chargesToBeDebited(
                clientId,
                serviceId,
                categoryId,
                req,
                TxnID,
                logger
            );
        }

        if (maintainanceResponse?.result) {
            logger.info(`Successfully deducted credits for client: ${clientId}, txnId: ${TxnID}`);
        } else {
            logger.warn(`Failed to deduct credits for client: ${clientId}, txnId: ${TxnID}. Response: ${JSON.stringify(maintainanceResponse)}`);
        }

        return maintainanceResponse;
    } catch (error) {
        logger.error(`Error in deductCredits service for client ${clientId}, txnId: ${TxnID} ${error.message}`, error);
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
