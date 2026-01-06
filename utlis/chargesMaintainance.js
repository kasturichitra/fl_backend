const { default: axios } = require("axios");
const {commonLogger} = require("../api/Logger/logger");
const superAdminUrl = process.env.SUPERADMIN_URL;

const chargesToBeDebited = async (clientId, service, tnxId) => {
  try {
    const objectToSent = {
      serviceId: service,
      clientId: clientId,
      transactionId: tnxId,
    };

    const response = await axios.post(
      `${superAdminUrl}/api/v1/apimodule/calculate-charges`,
      objectToSent,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("response in charges maintainance ====>>", response?.data);
    commonLogger.info("response in charges maintainance ====>>", response?.data);
  } catch (error) {
    console.log("error in charges maintainance ===>>", error);
  }
};

module.exports = chargesToBeDebited;
