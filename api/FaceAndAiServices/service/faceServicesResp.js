const { blurApiCall } = require("../providers/blurProviders");
const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen");

const blurServiceResponse = async (data, services = [], index = 0) => {
  if (index >= services.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services.find((s) => s.priority === index + 1);

  if (!newService) {
    return blurServiceResponse(data, services, index + 1);
  }

  const provider = newService.providerId;

  try {
    const res = await blurApiCall(data, provider);

    if (res?.success) return res.data;

    return blurServiceResponse(data, services, index + 1);
  } catch (err) {
    return blurServiceResponse(data, services, index + 1);
  }
};

const blurApiCall = async (data, service) => {
  const tskId = await generateTransactionId(12);
  const { file } = data;

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "93",
      },
      url: process.env.TRUTHSCREEN_IMAGE_BLURRINESS,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        password: process.env.TRUTHSCREEN_TOKEN,
      },
    },
  };

  const config = ApiData[service];
  if (!config) throw new Error(`Invalid service: ${service}`);

  let ApiResponse;

  try {
    if (service === "TRUTHSCREEN") {
      // multipart handled manually
      const form = new FormData();
      form.append("transID", tskId);
      form.append("docType", "93");
      form.append("file", file.buffer, { filename: file.originalname });

      const axios = require("axios");

      const res = await axios.post(config.url, form, {
        headers: {
          username: config.header.username,
          ...form.getHeaders(),
        },
      });

      ApiResponse = res.data;
    }
  } catch (error) {
    console.log(`[blurApiCall] Error in ${service}`, error.message);
    return { success: false };
  }

  /** Normalize response */
  let returnedObj = {};

  switch (service) {
    case "TRUTHSCREEN":
      returnedObj = {
        status: ApiResponse?.status,
        result: ApiResponse?.result,
        message:
          ApiResponse?.result === "Clear"
            ? "Clear"
            : ApiResponse?.result === "Blur"
            ? "Blur"
            : "Error",
      };
      break;
  }

  return {
    success: true,
    data: {
      result: returnedObj,
      message: returnedObj.message,
      responseOfService: ApiResponse,
      service,
    },
  };
}

module.exports = { blurServiceResponse };