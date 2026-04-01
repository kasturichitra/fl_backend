const { default: axios } = require("axios");
const { commonLogger } = require("../api/Logger/logger");
const superAdminUrl = process.env.SUPERADMIN_URL;

const creditsToBeDebited = async (clientId, service, categoryId, request) => {
  try {
    const objectToSent = {
      serviceId: service,
      clientId: clientId,
      categoryId: categoryId,
    };

    commonLogger.debug(
      `Credits deduction request for client: ${clientId}, service: ${service}, category: ${categoryId}`,
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

    commonLogger.info(
      `Credits deduction response: ${JSON.stringify(response?.data)}`,
    );
    if (response?.data?.success) {
      return { result: true };
    } else {
      commonLogger.warn(
        `Credits deduction failed for client ${clientId}: ${JSON.stringify(response?.data)}`,
      );
      return { result: false };
    }
  } catch (error) {
    commonLogger.error(
      `Error in credits maintainance for client ${clientId}: ${error.message}`,
    );
    throw error;
  }
};

module.exports = creditsToBeDebited;
