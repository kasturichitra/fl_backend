const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const { mobileToPanActiveServiceResponse } = require("../service/contactServicesResp");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");

exports.handleMobileToPanVerify = async (req, res) => {
  const data = req.body;
  const {
    mobileNumber = "",
    serviceId = "",
    categoryId = ""
  } = data;
  const isValid = handleValidation("mobile", mobileNumber, res);
  if (!isValid) return;

  contactServiceLogger.info("All inputs in pan are valid, continue processing...");

  const storingClient = req.clientId;

  try {
    contactServiceLogger.info(
      `Executing PAN NameDob verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });

    const panMobileRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!panMobileRateLimitResult.allowed) {
      contactServiceLogger.warn(
        `Rate limit exceeded for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panMobileRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    contactServiceLogger.info(`Generated PAN Mobile txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      contactServiceLogger.error(
        `Credit deduction failed for PAN Mobile verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const existingMobileNumber = await panNameDob.findOne({
      mobileNumber: encryptedPan,
    });

    contactServiceLogger.debug(
      `Checked for existing PAN NameDob record in DB: ${existingMobileNumber ? "Found" : "Not Found"}`,
    );

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      contactServiceLogger.warn(
        `Analytics update failed for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    if (existingMobileNumber) {
      if (existingMobileNumber?.status == 1) {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: existingMobileNumber?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        contactServiceLogger.info(
          `Returning cached valid PAN NameDob response for client: ${storingClient}`,
        );
        return res.json({
          message: "Valid",
          success: true,
          data: existingMobileNumber?.response,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: {
            pan: panNumber,
            ...findingInValidResponses("panNameDob"),
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        contactServiceLogger.info(
          `Returning cached invalid PAN NameDob response for client: ${storingClient}`,
        );
        return res.json({
          message: "InValid",
          success: false,
          data: {
            mobileNumber: mobileNumber,
            ...findingInValidResponses("panNameDob"),
          },
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      contactServiceLogger.warn(
        `Active service not found for PAN NameDob category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    contactServiceLogger.info(
      `Active service selected for PAN NameDob verification: ${service.serviceFor}`,
    );
    const response = await mobileToPanActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    contactServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN NameDob: ${response?.message}`,
    );

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.panNumber);
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPan,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      contactServiceLogger.info(
        `Valid PAN NameDob response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          panNumber: panNumber,
          ...findingInValidResponses("panNameDob"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      contactServiceLogger.info(
        `Invalid PAN NameDob response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber,
            ...findingInValidResponses("panNameDob"),
          },
          "InValid",
        ),
      );
    }
  } catch (error) {
    contactServiceLogger.error(
      `System error in PAN NameDob verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};