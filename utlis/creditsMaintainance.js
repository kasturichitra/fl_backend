const { default: axios } = require("axios");
const {commonLogger} = require("../api/Logger/logger");
const superAdminUrl = process.env.SUPERADMIN_URL;

const creditsToBeDebited = async (clientId, service, categoryId) => {
  try {
    const objectToSent = {
      serviceId: service,
      clientId: clientId,
      categoryId: categoryId
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
    if(response?.data?.success){
      return {result: true}
    }else{
      return {result: false}
    }
  } catch (error) {
    console.log("error in charges maintainance ===>>", error);
    throw error
  }
};

module.exports = creditsToBeDebited;
