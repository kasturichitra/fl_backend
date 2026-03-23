const { deductCredits } = require("../../../services/CreditService");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const { mapError } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const { pincodeGeofencingActiveServiceResponse } = require("../../GlobalApiserviceResponse/locationServicesResp");
const { locationServiceLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const pincodeGeofencingModel = require("../models/pincodeGeofencingModel");

exports.handlePincodeGeofencing = async (req, res) =>{
    const data = req.body;
      const {
        pincode,
        mobileNumber = "",
        serviceId = "",
        categoryId = "",
      } = data;
      const storingClient = req.clientId || "CID-6140971541";
    
      const capitalPanNumber = reusablePanNumberFieldVerification(
        panNumber,
        storingClient,
        res,
      );
    
      if (!capitalPanNumber) return;
      try {
        locationServiceLogger.info(
          `Executing PAN to GST verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
        );
    
        const identifierHash = hashIdentifiers({
          panNo: capitalPanNumber,
        });
    
        const panRateLimitResult = await checkingRateLimit({
          identifiers: { identifierHash },
          serviceId,
          categoryId: "GEOLOCATION",
          clientId: storingClient,
        });
    
        if (!panRateLimitResult.allowed) {
          locationServiceLogger.warn(
            `Rate limit exceeded for PAN to GST verification: client ${storingClient}, service ${serviceId}`,
          );
          return res.status(429).json({
            success: false,
            message: panRateLimitResult.message,
          });
        }
    
        const tnId = genrateUniqueServiceId();
        locationServiceLogger.info(`Generated PAN to GST txn Id: ${tnId}`);
    
        const maintainanceResponse = await deductCredits(
          storingClient,
          serviceId,
          categoryId,
          tnId,
          req.environment,
        );
    
        if (!maintainanceResponse?.result) {
          locationServiceLogger.error(
            `Credit deduction failed for PAN to GST verification: client ${storingClient}, txnId ${tnId}`,
          );
          return res.status(500).json({
            success: false,
            message: maintainanceResponse?.message || "InValid",
            response: {},
          });
        }
    
        const encryptedPan = encryptData(capitalPanNumber);
    
        const existingPanNumber = await pincodeGeofencingModel.findOne({
          panNumber: encryptedPan,
        });
    
        const analyticsResult = await AnalyticsDataUpdate(
          storingClient,
          serviceId,
          categoryId,
        );
        if (!analyticsResult.success) {
          locationServiceLogger.warn(
            `Analytics update failed for PAN to GST verification: client ${storingClient}, service ${serviceId}`,
          );
        }
    
        locationServiceLogger.debug(
          `Checked for existing PAN to GST record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
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
            locationServiceLogger.info(
              `Returning cached valid PAN to GST response for client: ${storingClient}`,
            );
            return res
              .status(200)
              .json(createApiResponse(200, decryptedResponse, "Valid"));
          } else {
            await responseModel.create({
              serviceId,
              categoryId,
              clientId: storingClient,
              result: {
                PAN: decryptedPanNumber,
              },
              createdTime: new Date().toLocaleTimeString(),
              createdDate: new Date().toLocaleDateString(),
            });
            locationServiceLogger.info(
              `Returning cached invalid PAN to GST response for client: ${storingClient}`,
            );
            return res
              .status(404)
              .json(createApiResponse(404, resOfPan, "InValid"));
          }
        }
    
        const service = await selectService(categoryId, serviceId);
    
        if (!service) {
          locationServiceLogger.warn(
            `Active service not found for PAN to GST category ${categoryId}, service ${serviceId}`,
          );
          return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }
    
        locationServiceLogger.info(
          `Active service selected for PAN to GST verification: ${service.serviceFor}`,
        );
        let response = await pincodeGeofencingActiveServiceResponse(
          panNumber,
          service,
          0,
          storingClient,
        );
    
        locationServiceLogger.info(
          `Response received from Pan to Gst for active service ${response?.service} with message: ${response?.message} for the client: ${storingClient} :: ${JSON.stringify(response)}`,
        );
    
        if (response?.message?.toLowerCase() === "all services failed") {
          throw new Error("All pan to gst services failed");
        }
    
        if (response?.message?.toUpperCase() == "VALID") {
          const encryptedPan = encryptData(response?.result?.PAN);
          const encryptedResponse = { ...response?.result, PAN: encryptedPan };
    
          await responseModel.create({
            serviceId,
            categoryId,
            clientId: storingClient,
            result: response?.result,
            createdTime: new Date().toLocaleTimeString(),
            createdDate: new Date().toLocaleDateString(),
          });
    
          const storingData = {
            pincode: encryptedPan,
            response: encryptedResponse,
            serviceResponse: response?.responseOfService,
            ...(mobileNumber && { mobileNumber }),
            status: 1,
            serviceName: response?.service,
            createdDate: new Date().toLocaleDateString(),
            createdTime: new Date().toLocaleTimeString(),
          };
    
          await pincodeGeofencingModel.create(storingData);
          locationServiceLogger.info(
            `Valid PAN to GST response stored and sent to client: ${storingClient}`,
          );
    
          return res
            .status(200)
            .json(createApiResponse(200, response?.result, "Valid"));
        } else {
          await responseModel.create({
            serviceId,
            categoryId,
            clientId: storingClient,
            result: { pan: panNumber, ...findingInValidResponses("pincodeGeofencing") },
            createdTime: new Date().toLocaleTimeString(),
            createdDate: new Date().toLocaleDateString(),
          });
    
          const storingData = {
            pincode: encryptedPan,
            response: {
              pan: panNumber,
              ...findingInValidResponses("pincodeGeofencing"),
            },
            status: 2,
            serviceResponse: {},
            ...(mobileNumber && { mobileNumber }),
            serviceName: response?.service,
            createdDate: new Date().toLocaleDateString(),
            createdTime: new Date().toLocaleTimeString(),
          };
    
          await pincodeGeofencingModel.create(storingData);
          locationServiceLogger.info(
            `Invalid PAN to GST response stored and sent to client: ${storingClient}`,
          );
          return res
            .status(404)
            .json(
              createApiResponse(
                404,
                { pan: panNumber, ...findingInValidResponses("pincodeGeofencing") },
                "InValid",
              ),
            );
        }
      } catch (error) {
        locationServiceLogger.error(
          `System error in pincode geofencing for client ${storingClient}: ${error.message}`,
          error,
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
      }
}

exports.handleLongLatGeofencing = async (req, res) =>{
       const data = req.body;
      const {
        panNumber,
        mobileNumber = "",
        serviceId = "",
        categoryId = "",
      } = data;
      const storingClient = req.clientId || "CID-6140971541";
    
      const capitalPanNumber = reusablePanNumberFieldVerification(
        panNumber,
        storingClient,
        res,
      );
    
      if (!capitalPanNumber) return;
      try {
        locationServiceLogger.info(
          `Executing PAN to GST verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
        );
    
        const identifierHash = hashIdentifiers({
          panNo: capitalPanNumber,
        });
    
        const panRateLimitResult = await checkingRateLimit({
          identifiers: { identifierHash },
          serviceId,
          categoryId: "GEOLOCATION",
          clientId: storingClient,
        });
    
        if (!panRateLimitResult.allowed) {
          locationServiceLogger.warn(
            `Rate limit exceeded for PAN to GST verification: client ${storingClient}, service ${serviceId}`,
          );
          return res.status(429).json({
            success: false,
            message: panRateLimitResult.message,
          });
        }
    
        const tnId = genrateUniqueServiceId();
        locationServiceLogger.info(`Generated PAN to GST txn Id: ${tnId}`);
    
        const maintainanceResponse = await deductCredits(
          storingClient,
          serviceId,
          categoryId,
          tnId,
          req.environment,
        );
    
        if (!maintainanceResponse?.result) {
          locationServiceLogger.error(
            `Credit deduction failed for PAN to GST verification: client ${storingClient}, txnId ${tnId}`,
          );
          return res.status(500).json({
            success: false,
            message: maintainanceResponse?.message || "InValid",
            response: {},
          });
        }
    
        const encryptedPan = encryptData(capitalPanNumber);
    
        const existingPanNumber = await pincodeGeofencingModel.findOne({
          panNumber: encryptedPan,
        });
    
        const analyticsResult = await AnalyticsDataUpdate(
          storingClient,
          serviceId,
          categoryId,
        );
        if (!analyticsResult.success) {
          locationServiceLogger.warn(
            `Analytics update failed for PAN to GST verification: client ${storingClient}, service ${serviceId}`,
          );
        }
    
        locationServiceLogger.debug(
          `Checked for existing PAN to GST record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
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
            locationServiceLogger.info(
              `Returning cached valid PAN to GST response for client: ${storingClient}`,
            );
            return res
              .status(200)
              .json(createApiResponse(200, decryptedResponse, "Valid"));
          } else {
            await responseModel.create({
              serviceId,
              categoryId,
              clientId: storingClient,
              result: {
                PAN: decryptedPanNumber,
              },
              createdTime: new Date().toLocaleTimeString(),
              createdDate: new Date().toLocaleDateString(),
            });
            locationServiceLogger.info(
              `Returning cached invalid PAN to GST response for client: ${storingClient}`,
            );
            return res
              .status(404)
              .json(createApiResponse(404, resOfPan, "InValid"));
          }
        }
    
        const service = await selectService(categoryId, serviceId);
    
        if (!service) {
          locationServiceLogger.warn(
            `Active service not found for PAN to GST category ${categoryId}, service ${serviceId}`,
          );
          return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }
    
        locationServiceLogger.info(
          `Active service selected for PAN to GST verification: ${service.serviceFor}`,
        );
        let response = await pincodeGeofencingActiveServiceResponse(
          panNumber,
          service,
          0,
          storingClient,
        );
    
        locationServiceLogger.info(
          `Response received from Pan to Gst for active service ${response?.service} with message: ${response?.message} for the client: ${storingClient} :: ${JSON.stringify(response)}`,
        );
    
        if (response?.message?.toLowerCase() === "all services failed") {
          throw new Error("All pan to gst services failed");
        }
    
        if (response?.message?.toUpperCase() == "VALID") {
          const encryptedPan = encryptData(response?.result?.PAN);
          const encryptedResponse = { ...response?.result, PAN: encryptedPan };
    
          await responseModel.create({
            serviceId,
            categoryId,
            clientId: storingClient,
            result: response?.result,
            createdTime: new Date().toLocaleTimeString(),
            createdDate: new Date().toLocaleDateString(),
          });
    
          const storingData = {
            pincode: encryptedPan,
            response: encryptedResponse,
            serviceResponse: response?.responseOfService,
            ...(mobileNumber && { mobileNumber }),
            status: 1,
            serviceName: response?.service,
            createdDate: new Date().toLocaleDateString(),
            createdTime: new Date().toLocaleTimeString(),
          };
    
          await pincodeGeofencingModel.create(storingData);
          locationServiceLogger.info(
            `Valid PAN to GST response stored and sent to client: ${storingClient}`,
          );
    
          return res
            .status(200)
            .json(createApiResponse(200, response?.result, "Valid"));
        } else {
          await responseModel.create({
            serviceId,
            categoryId,
            clientId: storingClient,
            result: { pan: panNumber, ...findingInValidResponses("pincodeGeofencing") },
            createdTime: new Date().toLocaleTimeString(),
            createdDate: new Date().toLocaleDateString(),
          });
    
          const storingData = {
            pincode: encryptedPan,
            response: {
              pan: panNumber,
              ...findingInValidResponses("pincodeGeofencing"),
            },
            status: 2,
            serviceResponse: {},
            ...(mobileNumber && { mobileNumber }),
            serviceName: response?.service,
            createdDate: new Date().toLocaleDateString(),
            createdTime: new Date().toLocaleTimeString(),
          };
    
          await pincodeGeofencingModel.create(storingData);
          locationServiceLogger.info(
            `Invalid PAN to GST response stored and sent to client: ${storingClient}`,
          );
          return res
            .status(404)
            .json(
              createApiResponse(
                404,
                { pan: panNumber, ...findingInValidResponses("pincodeGeofencing") },
                "InValid",
              ),
            );
        }
      } catch (error) {
        locationServiceLogger.error(
          `System error in pincode geofencing for client ${storingClient}: ${error.message}`,
          error,
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
      }
}