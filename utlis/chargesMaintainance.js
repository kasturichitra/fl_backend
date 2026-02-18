const { default: axios } = require("axios");
const { commonLogger } = require("../api/Logger/logger");
const superAdminUrl = process.env.SUPERADMIN_URL;

const chargesToBeDebited = async (clientId, service, tnxId, environment) => {
  try {
    const objectToSent = {
      serviceId: service,
      clientId: clientId,
      transactionId: tnxId,
      // environment
    };
    let response;
    if (environment === 'LIVE') {
      response = await axios.post(
        `${superAdminUrl}/api/v1/apimodule/calculate-charges`,
        objectToSent,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Need to integrate for test environment
    if (environment === 'TEST') {
      response = await axios.post(
        `${superAdminUrl}/api/v1/apimodule/calculate-charges`,
        objectToSent,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("response in charges maintainance ====>>", response?.data);
    commonLogger.info("response in charges maintainance ====>>", response?.data);
  } catch (error) {
    console.log("error in charges maintainance ===>>", error);
  }
};

module.exports = chargesToBeDebited;
