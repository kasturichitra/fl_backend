const { deductCredits } = require("../../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../../utils/analyticsStoring");
const { createApiResponse } = require("../../../../utils/ApiResponseHandler");
const checkingRateLimit = require("../../../../utils/checkingRateLimit");
const { encryptData } = require("../../../../utils/EncryptAndDecrypt");
const { mapError } = require("../../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../../utils/hashIdentifier");
const { DinActiveServiceResponse } = require("../../../GlobalApiserviceResponse/dinServiceResponse");
const { businessServiceLogger } = require("../../../Logger/logger");
const { selectService } = require("../../../service/serviceSelector");
const responseModel = require("../../../serviceResponses/model/serviceResponseModel");
const din_verifyModel = require('../module/dinModel.js')

exports.dinVerification = async (req, res) => {
    const {
        dinNumber,
        serviceId = "",
        categoryId = "",
        mobileNumber = "",
    } = req.body;
    const clientId = req.clientId || categoryId;

    businessServiceLogger.info(`DIN NUMBER Details: ${dinNumber}`);
    try {
        businessServiceLogger.info(
            `Executing DIN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
        );

        const indetifierHash = hashIdentifiers({
            dinNo: dinNumber
        });

        const dinRateLimitResult = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!dinRateLimitResult.allowed) {
            businessServiceLogger.warn(`Rate limit exceeded for DIN verification: client ${clientId}, service ${serviceId}`);
            return res.status(429).json({
                success: false,
                message: dinRateLimitResult.message,
            });
        };

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated DIN txn Id: ${tnId}`);

        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.error(`Credit deduction failed for DIN verification: client ${clientId}, txnId ${tnId}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        const encryptedDin = encryptData(dinNumber);

        const existingDin = await din_verifyModel.findOne({ dinNumber: encryptedDin })

        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.warn(
                `Analytics update failed for DIN verification: client ${clientId}, service ${serviceId}`,
            );
        }

        businessServiceLogger.info(
            `Checked for existing DIN record in DB: ${existingDin ? "Found" : "Not Found"}, `,
        );

        if (existingDin) {
            if (existingDin?.status == 1) {
                businessServiceLogger.info(
                    `Returning cached DIN response for client: ${clientId}`,
                );

                const decrypted = {
                    ...existingDin?.response,
                    dinNumber: dinNumber,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingDin?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            } else {
                businessServiceLogger.info(
                    `Returning cached din response for client: ${clientId}`,
                );
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingDin?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingDin?.response;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            }
        }

        const service = await selectService(categoryId, serviceId);
        if (!service) {
            businessServiceLogger.warn(
                `Active service not found for DIN category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }

        let response = await DinActiveServiceResponse(dinNumber, service, 0);
        businessServiceLogger.info(
            `Response received from active service ${service.serviceFor}: ${response?.message}`,
        );

        businessServiceLogger.info(
            `Active service selected for DIN verification: ${service.serviceFor}`,
        );

        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                dinNumber: encryptedDin,
            };
            await responseModel.create({
                serviceId,
                categoryId,
                clientId,
                result: response?.result,
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 1,
                dinNumber: encryptedDin,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await din_verifyModel.create(storingData);
            businessServiceLogger.info(
                `Valid DIN response stored and sent to client: ${clientId}`,
            );
            return res
                .status(200)
                .json(createApiResponse(200, response?.result, "Success"));
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
                clientId,
                result: {
                    dinNumber: dinNumber,
                    // ...findingInValidResponses("Din"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 2,
                dinNumber: encryptedDin,
                response: {
                    dinNumber: dinNumber,
                    // ...findingInValidResponses("Din"),
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await din_verifyModel.create(storingData);
            businessServiceLogger.info(
                `Invalid GSTIN response received and sent to client: ${clientId}`,
            );
            return res
                .status(404)
                .json(createApiResponse(404, { dinNumber: dinNumber }, "Failed"));
        }

    } catch (error) {
        businessServiceLogger.error(
            `System error in DIN verification for client ${clientId}: ${error.message}`,
            error,
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
}

