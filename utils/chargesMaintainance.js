const { default: axios } = require("axios");
const superAdminUrl = process.env.SUPERADMIN_URL;

const chargesToBeDebited = async (clientId, service, category, request,TxnID,logger) => {
  try {
    const objectToSent = {
      serviceId: service,
      categoryId: category,
      clientId: clientId,
      transactionId: tnxId,
    };
    logger.debug(`txnId: ${TxnID},Charges deduction request for client: ${clientId}, service: ${service}, category: ${category}, txnId: ${tnxId}`);
    let response;
    response = await axios.post(
      `${superAdminUrl}/api/v1/apimodule/calculate-charges`,
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
      }
    );
    logger.info(`txnId: ${TxnID}Charges deduction response: ${JSON.stringify(response?.data)}`);
    if (response?.data?.success) {
      return { result: true }
    } else {
      logger.warn(`Charges deduction failed for client ${clientId}, txnId: ${TxnID}: ${JSON.stringify(response?.data)}`);
      return { result: false }
    }
  } catch (error) {
    logger.error(`Error in charges maintainance for client ${clientId}, txnId: ${TxnID}: ${error?.response?.data.message || error.message} `);
    throw error
  }
};

module.exports = chargesToBeDebited;
