const { default: axios } = require("axios");
const { commonLogger } = require("../api/Logger/logger");
const superAdminUrl = process.env.SUPERADMIN_URL;

const chargesToBeDebited = async (clientId, service, category, tnxId) => {
  try {
    const objectToSent = {
      serviceId: service,
      categoryId: category,
      clientId: clientId,
      transactionId: tnxId,
    };
    commonLogger.debug(`Charges deduction request for client: ${clientId}, service: ${service}, category: ${category}, txnId: ${tnxId}`);
    let response;
    response = await axios.post(
      `${superAdminUrl}/api/v1/apimodule/calculate-charges`,
      objectToSent,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    commonLogger.info(`Charges deduction response: ${JSON.stringify(response?.data)}`);
    if (response?.data?.success) {
      return { result: true }
    } else {
      commonLogger.warn(`Charges deduction failed for client ${clientId}, txnId: ${tnxId}: ${JSON.stringify(response?.data)}`);
      return { result: false }
    }
  } catch (error) {
    commonLogger.error(`Error in charges maintainance for client ${clientId}, txnId: ${tnxId}: ${error.message}`);
    throw error
  }
};

module.exports = chargesToBeDebited;
