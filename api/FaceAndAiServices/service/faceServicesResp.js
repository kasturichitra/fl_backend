const { response } = require("express");
const { faceServiceLogger } = require("../../Logger/logger");
const { generateTransactionId, callTruthScreenAPIForImage } = require("../../truthScreen/callTruthScreen");

const SERVICE_CONFIG = {
  BLUR_CHECK: {
    TRUTHSCREEN: {
      url: process.env.TRUTHSCREEN_IMAGE_BLURRINESS,
      docType: 93,
    },
  },
  AI_IMAGE_CHECK: {
    TRUTHSCREEN: {
      url: process.env.TRUTHSCREEN_IMAGE_AI,
      docType: 579,
    },
  },
  DEEPFAKE_IMAGE_CHECK: {
    TRUTHSCREEN: {
      url: process.env.TRUTHSCREEN_IMAGE_DEEPFAKE,
      docType: 578,
    },
  },
  AI_AND_DEEPFAKE_IMAGE_CHECK: {
    TRUTHSCREEN: {
      url: process.env.TRUTHSCREEN_IMAGE_AI_DEEPFAKE,
      docType: 580,
    },
  },
};

const imageActiveServiceResponse = async (
  data,
  services = [],
  serviceKey,
  index = 0,
  client,
) => {
  const sortedServices = [...services].sort((a, b) => a.priority - b.priority);

  if (index >= sortedServices.length) {
    return { success: false, message: "All services failed" };
  }

  const currentService = sortedServices[index];
  const provider = currentService.providerId;

  try {
    const res = await imageApiCall(data, provider, serviceKey, client);

    if (res?.success) return res.data;

    return imageActiveServiceResponse(
      data,
      sortedServices,
      serviceKey,
      index + 1,
    );
  } catch (err) {
    return imageActiveServiceResponse(
      data,
      sortedServices,
      serviceKey,
      index + 1,
    );
  }
};

const imageApiCall = async (data, service, serviceKey, CID) => {
  const txnId = await generateTransactionId(12);
  const { file } = data;

  const config = SERVICE_CONFIG?.[serviceKey]?.[service];

  faceServiceLogger.info(`config: ${config} found for this client: ${CID}`)

  if (!config) {
    throw new Error(`Invalid config for ${serviceKey} - ${service}`);
  }

  let apiResponse;

  try {
    if (service === "TRUTHSCREEN") {
      const faceRes = await callTruthScreenAPIForImage({
        url: config.url,
        payload: {
          transID: txnId,
          docType: config.docType,
        },
        file,
        username: process.env.TRUTHSCREEN_USERNAME,
        password: process.env.TRUTHSCREEN_TOKEN,
        cId: CID,
      });

      apiResponse = faceRes.data;
    }
  } catch (error) {
    console.error(
      `[ERROR] ${serviceKey} api error with service: ${service} error:`,
      JSON.stringify(error),
    );
    console.error(
      `[ERROR][MESSAGE] ${serviceKey} api error with service: ${service} error: ${error?.message}`
    );

    return {
      success: false,
      error: error?.response?.data || error.message,
    };
  }

  console.log(`active service: ${service} and it's apiResponse: ${apiResponse}`)

  // ✅ Normalize response
  let normalized = {};

  switch (service) {
    case "TRUTHSCREEN":
      normalized = {
        status: apiResponse?.status,
        result: apiResponse?.result,
        message:
          apiResponse?.result === "Clear"
            ? "CLEAR"
            : apiResponse?.result === "Blur"
              ? "BLUR"
              : "ERROR",
      };
      break;
  }

  return {
    success: true,
    data: {
      result: normalized,
      response: normalized,
      responseOfService: apiResponse,
      service,
    },
  };
};

module.exports = { imageActiveServiceResponse };
