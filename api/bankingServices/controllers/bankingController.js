const { chequeClassifyActiveServiceResponse } = require("../service/bankingServiceResp");

exports.handleBSAViaNetBanking = async (req, res) => {
  const data = req.body;
  const {
    panNumber,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = data;
  const capitalPanNumber = panNumber?.toUpperCase();

  const isValid = handleValidation("pan", capitalPanNumber, res);
  if (!isValid) return;

  bankServiceLogger.info("All inputs in pan are valid, continue processing...");

  const storingClient = req.clientId || clientId;

  try {
    bankServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    bankServiceLogger.info(
      `Generated PAN txn Id: ${tnId} for the client: ${storingClient}`,
    );

    // Common: hash identifier
    // const identifierHash = hashIdentifiers({
    //   panNo: capitalPanNumber,
    // });

    // const panRateLimitResult = await checkingRateLimit({
    //   identifiers: { identifierHash },
    //   serviceId,
    //   categoryId,
    //   clientId: storingClient,
    // });

    // if (!panRateLimitResult.allowed) {
    //   bankServiceLogger.warn(
    //     `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
    //   );
    //   return res.status(429).json({
    //     success: false,
    //     message: panRateLimitResult.message,
    //   });
    // }

    // const maintainanceResponse = await deductCredits(
    //       storingClient,
    //       serviceId,
    //       categoryId,
    //       tnId,
    //       req.environment,
    //     );

    // if (!maintainanceResponse?.result) {
    //   bankServiceLogger.error(
    //     `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "Invalid",
    //     response: {},
    //   });
    // }

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panverificationModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      bankServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    bankServiceLogger.debug(
      `Checked for existing PAN record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );
    if (existingPanNumber) {
      const decryptedPanNumber = decryptData(existingPanNumber?.panNumber);
      const resOfPan = existingPanNumber?.response;

      if (existingPanNumber?.status == 1) {
        const decryptedResponse = {
          ...existingPanNumber?.response,
          PAN: decryptedPanNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        bankServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Valid",
          data: decryptedResponse,
          success: true,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: resOfPan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        bankServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          data: resOfPan,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      bankServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    bankServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let panNumberResponse = await PanActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    bankServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${panNumberResponse?.message}`,
    );

    if (panNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(panNumberResponse?.result?.PAN);
      const encryptedResponse = {
        ...panNumberResponse?.result,
        PAN: encryptedPan,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: panNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        userName: panNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: panNumberResponse?.responseOfService,
        status: 1,
        mobileNumber,
        serviceId: `${panNumberResponse?.service}_panBasic`,
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      bankServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { pan: panNumber, ...findingInValidResponses("panBasic") },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: findingInValidResponses("panBasic"),
        serviceResponse: panNumberResponse?.responseOfService,
        status: 2,
        mobileNumber,
        serviceId: `${panNumberResponse?.service}_panBasic`,
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panverificationModel.create(storingData);
      bankServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(
          createApiResponse(
            404,
            { pan: panNumber, ...findingInValidResponses("panBasic") },
            "Failed",
          ),
        );
    }
  } catch (error) {
    bankServiceLogger.error(
      `System error in bsa via nb for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleChequeClassification = async (req, res) => {
    const data = req.body;
  const {
    panNumber,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = data;
  const capitalPanNumber = panNumber?.toUpperCase();

  const isValid = handleValidation("pan", capitalPanNumber, res);
  if (!isValid) return;

  bankServiceLogger.info("All inputs in pan are valid, continue processing...");

  const storingClient = req.clientId || clientId;

  try {
    bankServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    bankServiceLogger.info(
      `Generated PAN txn Id: ${tnId} for the client: ${storingClient}`,
    );

    // Common: hash identifier
    // const identifierHash = hashIdentifiers({
    //   panNo: capitalPanNumber,
    // });

    // const panRateLimitResult = await checkingRateLimit({
    //   identifiers: { identifierHash },
    //   serviceId,
    //   categoryId,
    //   clientId: storingClient,
    // });

    // if (!panRateLimitResult.allowed) {
    //   bankServiceLogger.warn(
    //     `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
    //   );
    //   return res.status(429).json({
    //     success: false,
    //     message: panRateLimitResult.message,
    //   });
    // }

    // const maintainanceResponse = await deductCredits(
    //       storingClient,
    //       serviceId,
    //       categoryId,
    //       tnId,
    //       req.environment,
    //     );

    // if (!maintainanceResponse?.result) {
    //   bankServiceLogger.error(
    //     `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "Invalid",
    //     response: {},
    //   });
    // }

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panverificationModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      bankServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    bankServiceLogger.debug(
      `Checked for existing PAN record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );
    if (existingPanNumber) {
      const decryptedPanNumber = decryptData(existingPanNumber?.panNumber);
      const resOfPan = existingPanNumber?.response;

      if (existingPanNumber?.status == 1) {
        const decryptedResponse = {
          ...existingPanNumber?.response,
          PAN: decryptedPanNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        bankServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Valid",
          data: decryptedResponse,
          success: true,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: resOfPan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        bankServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          data: resOfPan,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId, storingClient, req);

    if (!service?.length) {
      bankServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    bankServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let panNumberResponse = await chequeClassifyActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    bankServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${panNumberResponse?.message}`,
    );

    if (panNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(panNumberResponse?.result?.PAN);
      const encryptedResponse = {
        ...panNumberResponse?.result,
        PAN: encryptedPan,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: panNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        userName: panNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: panNumberResponse?.responseOfService,
        status: 1,
        mobileNumber,
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      bankServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { pan: panNumber },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: { pan: panNumber },
        serviceResponse: panNumberResponse?.responseOfService,
        status: 2,
        mobileNumber,
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panverificationModel.create(storingData);
      bankServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(
          createApiResponse(
            404,
            { pan: panNumber },
            "Failed",
          ),
        );
    }
  } catch (error) {
    bankServiceLogger.error(
      `System error in bsa via nb for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
}
