const { default: axios } = require("axios");
const superAdminUrl = process.env.SUPERADMIN_URL;

<<<<<<< HEAD
const creditsToBeDebited = async (clientId, service, categoryId, request, logger) => {
=======
const creditsToBeDebited = async (clientId, service, categoryId, request,TxnID,logger) => {
>>>>>>> vishnu
  try {
    const objectToSent = {
      serviceId: service,
      clientId: clientId,
      categoryId: categoryId,
    };

<<<<<<< HEAD
    logger.debug(
      `Credits deduction request for client: ${clientId}, service: ${service}, category: ${categoryId}`,
=======
    logger.info(
      `txnId: ${TxnID} Credits deduction request for client: ${clientId}, service: ${service}, category: ${categoryId}`,
>>>>>>> vishnu
    );
    const response = await axios.post(
      `${superAdminUrl}/api/v1/apimodule/deduct-credit`,
      objectToSent,
      {
        headers: {
          client_id: request.client_id,
          client_secret: request.client_secret,
          projectId: process.env.PROJECT_ID,
          "Content-Type": "application/json",
          client_id: request.client_id,
          client_secret: request.client_secret,
          projectId: process.env.PROJECT_ID,
        },
      },
    );

    logger.info(
      `txnId: ${TxnID} Credits deduction response: ${JSON.stringify(response?.data)}`,
    );
    if (response?.data?.success) {
      return { result: true };
    } else {
      logger.warn(
        `txnId: ${TxnID} Credits deduction failed for client ${clientId}: ${JSON.stringify(response?.data)}`,
      );
      return { result: false };
    }
  } catch (error) {
    logger.error(
      `txnId: ${TxnID}, Error in credits maintainance for client ${clientId}: ${error.message}`,
    );
    throw error;
  }
};

module.exports = creditsToBeDebited;
