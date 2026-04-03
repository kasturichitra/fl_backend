const { faceServiceLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPIForImage,
} = require("../../truthScreen/callTruthScreen");

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
  const fn = "imageActiveServiceResponse"
  const cid = client || "UN_KNOWN"
   faceServiceLogger.info(
      `[${fn}] request started for this client: ${cid}===>>`,
    );
  const sortedServices = [...services].sort((a, b) => a.priority - b.priority);

  if (index >= sortedServices.length) {
    faceServiceLogger.info(
      `[${fn}] all services failed for this client: ${cid} ===>>`,
    );
    return { success: false, message: "All services failed" };
  }

  const currentService = sortedServices[index];
  const provider = currentService.providerId;

  faceServiceLogger.info(
      `[${fn}] Trying service ${provider} with priority index: ${index + 1} for this client: ${cid}`
    );

  try {
    const res = await imageApiCall(data, provider, serviceKey, client);

    faceServiceLogger.info(
      `[${fn}] response: ${JSON.stringify(res)} from imageApiCall for this client: ${idOfclient} with data: ${data?.slice(0,4)}`,
    );

    if (res?.data) return res.data;

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
  const fn = "imageApiCall"
  const { file } = data;

  const config = SERVICE_CONFIG?.[serviceKey]?.[service];

  faceServiceLogger.info(
    `[${fn}] config: ${JSON.stringify(config)} found for serviceKey: ${serviceKey} for this client: ${CID}`,
  );

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

      console.log("faceRes ===>>", faceRes);

      apiResponse = faceRes;
    }
  } catch (error) {
    console.error(
      `[ERROR] ${serviceKey} api error with service: ${service} error:`,
      JSON.stringify(error),
    );
    faceServiceLogger.error(
      `[ERROR][MESSAGE] ${serviceKey} api error with service: ${service} error: ${error?.message}`,
    );

    return {
      success: false,
      error: error?.response?.data || error.message,
    };
  }

  faceServiceLogger.info(
    `[${serviceKey}]active service: ${service} and it's apiResponse: ${JSON.stringify(apiResponse)} for this client: ${CID}`,
  );

  // ✅ Normalize response
  let normalized = {};

  switch (service) {
    case "TRUTHSCREEN":
      if (
        apiResponse?.status == 0 &&
        apiResponse?.msg?.toLowerCase().includes("something went wrong")
      ) {
        return {
          success: false,
          data: null,
        };
      }
      if (config.docType == 93) {
        if (apiResponse?.status) {
          return {
            success: true,
            data: {
              result: apiResponse?.result,
              message: "Valid",
              responseOfService: apiResponse,
              service,
            },
          };
        }
      } else {
        if (apiResponse?.status) {
          const isValid = apiResponse?.status == 1;
          normalized = isValid ? apiResponse?.msg : {};
          return {
            success: isValid ? true : false,
            data: {
              result: normalized,
              message: isValid ? "Valid" : "Invalid",
              responseOfService: isValid ? apiResponse : {},
              service,
            },
          };
        }
      }
      break;
  }

  return {
    success: true,
    data: {
      result: normalized,
      message: "Valid",
      responseOfService: apiResponse,
      service,
    },
  };
};

module.exports = { imageActiveServiceResponse };
