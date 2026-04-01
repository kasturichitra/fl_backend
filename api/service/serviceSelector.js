const { default: axios } = require("axios");

async function selectService(servicecategory, serviceName, client = "", req) {
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
    console.log("Final selected service =>", FinalService?.data);
    const { success, statusCode, data } = FinalService?.data;
    if (success) {
      console.log("Final selected service =>", data);
      return data;
    }
  } catch (error) {
    console.log("SelectService Error:", error);
    return [];
  }
}

module.exports = { selectService };
