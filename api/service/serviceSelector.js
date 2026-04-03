const { default: axios } = require("axios");

async function selectService(servicecategory, serviceName, tnId = "", req, logger = "") {
  const headers = {
    client_id: req.client_id,
    client_secret: req.client_secret,
    projectId: process.env.PROJECT_ID,
  };
  try {
    const FinalService = await axios.get(
      `${process.env.SUPERADMIN_URL}/api/v1/apimodule/getAllProvidersByService?serviceId=${serviceName}&categoryId=${servicecategory}`,
      { headers: headers },
    );
    const { success, statusCode, data } = FinalService?.data;
    if (success) {
      logger.info(`providers list with TXNID: ${tnId} for this category: ${servicecategory} and service: ${serviceName} Data ${JSON.stringify(data)} =>`);
      return data;
    }else{
      return [];
    }
  } catch (error) {
    logger.error(`SelectService Error for this TXNID: ${tnId}: ${error}`);
    return [];
  }
}

module.exports = { selectService };
