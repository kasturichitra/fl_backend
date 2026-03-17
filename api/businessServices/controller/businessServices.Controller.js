const { deductCredits } = require("../../../services/CreditService.js");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring.js");
const { createApiResponse } = require("../../../utils/ApiResponseHandler.js");
const checkingRateLimit = require("../../../utils/checkingRateLimit.js");
const { encryptData } = require("../../../utils/EncryptAndDecrypt.js");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes.js");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId.js");
const { hashIdentifiers } = require("../../../utils/hashIdentifier.js");
const { DinActiveServiceResponse } = require("../../GlobalApiserviceResponse/dinServiceResponse.js");
const { businessServiceLogger } = require("../../Logger/logger.js");
const { selectService } = require("../../service/serviceSelector.js");
const responseModel = require("../../serviceResponses/model/serviceResponseModel.js");
const {
    GSTtoPANActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/GSTtoPANActiveServiceResponse");
const gstin_verifyModel = require("../module/gstin_verify.model.js");
const gstInTaxpayer = require("../module/gstin_taxpayer.model.js")
const gstin_panModel = require("../module/gstin_pan.model.js");
const din_verifyModel = require('../module/dinModel.js')
const { CinActiveServiceResponse } = require("../../GlobalApiserviceResponse/CinServiceResponse.js");
const IncorporationCertificateModel = require("../module/IncorporationCertificateModel.js");
const { response } = require("express");
const handleValidation = require("../../../utils/lengthCheck.js");
const { GstTaxpayerActiveServiceResponse } = require("../../GlobalApiserviceResponse/gstinTaxpayerServiceResp.js");

// DIN VERIFICATION
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

        //1. HASH DIN NUMBER
        const indetifierHash = hashIdentifiers({
            dinNo: dinNumber
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
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

        // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
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

        // 4. CHECK IN THE DB IS DATA PRESENT 
        const encryptedDin = encryptData(dinNumber);

        const existingDin = await din_verifyModel.findOne({ dinNumber: encryptedDin })

        // 5. UPDATE TO THE ANALYTICS COLLECTION
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

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
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

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);
        if (!service) {
            businessServiceLogger.warn(
                `Active service not found for DIN category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
        let response = await DinActiveServiceResponse(dinNumber, service, 0);
        businessServiceLogger.info(
            `Response received from active service ${service.serviceFor}: ${response?.message}`,
        );

        businessServiceLogger.info(
            `Active service selected for DIN verification: ${service.serviceFor}`,
        );

        // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
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
                `Invalid DIN response received and sent to client: ${clientId}`,
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
};

// GST IN VERIFY
exports.gstinverify = async (req, res, next) => {
    const {
        gstinNumber,
        serviceId = "",
        categoryId = "",
        mobileNumber = "",
    } = req.body;

    if (!gstinNumber || !serviceId || !categoryId) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }

    const clientId = req.clientId || categoryId;
    const environment = req.environment;

    businessServiceLogger.info(
        `gstinNumber Details ===>> gstinNumber: ${gstinNumber}`,
    );

    try {
        const capitalGstNumber = gstinNumber?.toUpperCase();
        const isValid = handleValidation("gstin", capitalGstNumber, res);
        if (!isValid) return;

        businessServiceLogger.info(
            `Executing GSTIN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
        );

        const identifierHash = hashIdentifiers({
            gstNo: capitalGstNumber,
        });

        const gstRateLimitResult = await checkingRateLimit({
            identifiers: { identifierHash },
            serviceId,
            categoryId,
            clientId: clientId,
        });

        if (!gstRateLimitResult.allowed) {
            businessServiceLogger.warn(`Rate limit exceeded for GSTIN verification: client ${clientId}, service ${serviceId}`);
            return res.status(429).json({
                success: false,
                message: gstRateLimitResult.message,
            });
        }

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated GSTIN txn Id: ${tnId}`);

        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.error(`Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        const encryptedGst = encryptData(gstinNumber);

        // Check if the record is present in the DB
        const existingGstin = await gstin_verifyModel.findOne({
            gstinNumber: encryptedGst,
        });

        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.warn(
                `Analytics update failed for GSTIN verification: client ${clientId}, service ${serviceId}`,
            );
        }

        businessServiceLogger.debug(
            `Checked for existing GSTIN record in DB: ${existingGstin ? "Found" : "Not Found"}`,
        );
        if (existingGstin) {
            if (existingGstin?.status == 1) {
                businessServiceLogger.info(
                    `Returning cached GSTIN response for client: ${clientId}`,
                );

                const decrypted = {
                    ...existingGstin?.response,
                    gstinNumber: gstinNumber,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingGstin?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            } else {
                businessServiceLogger.info(
                    `Returning cached GSTIN response for client: ${clientId}`,
                );
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingGstin?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingGstin?.response;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            }
        }

        // Get All Active Services
        const service = await selectService(categoryId, serviceId);
        if (!service) {
            businessServiceLogger.warn(
                `Active service not found for GSTIN category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }

        businessServiceLogger.info(
            `Active service selected for GSTIN verification: ${service.serviceFor}`,
        );

        //  get Acitve Service Response
        let response = await GSTtoPANActiveServiceResponse(gstinNumber, service, 0);
        businessServiceLogger.info(
            `Response received from active service ${service.serviceFor}: ${response?.message}`,
        );

        // Response form Active Service if response message is Valid
        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                gstinNumber: encryptedGst,
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
                gstinNumber: encryptedGst,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await gstin_verifyModel.create(storingData);
            businessServiceLogger.info(
                `Valid GSTIN response stored and sent to client: ${clientId}`,
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
                    gstinNumber: gstinNumber,
                    ...findingInValidResponses("gstIn"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 2,
                gstinNumber: encryptedGst,
                response: {
                    gstinNumber: gstinNumber,
                    ...findingInValidResponses("gstIn"),
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await gstin_verifyModel.create(storingData);
            businessServiceLogger.info(
                `Invalid GSTIN response received and sent to client: ${clientId}`,
            );
            return res
                .status(404)
                .json(createApiResponse(404, { gstinNumber }, "Failed"));
        }
    } catch (error) {
        businessServiceLogger.error(
            `System error in GSTIN verification for client ${clientId}: ${error.message}`,
            error,
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

// GST TO PAN VERIFICATION
exports.handleGST_INtoPANDetails = async (req, res, next) => {
    const {
        gstinNumber,
        serviceId = "",
        categoryId = "",
        mobileNumber = "",
    } = req.body;
    const clientId = req.clientId;
    const isClient = req.role;

    businessServiceLogger.info(
        `gstinNumber Details ===>> gstinNumber: ${gstinNumber}`,
    );
    try {
        if (!gstinNumber) {
            return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
        }
        const capitalGstNumber = gstinNumber?.toUpperCase();

        const isValid = handleValidation("gstin", capitalGstNumber, res);
        if (!isValid) return;

        const identifierHash = hashIdentifiers({
            gstNo: capitalGstNumber,
        });

        const gstRateLimitResult = await checkingRateLimit({
            identifiers: { identifierHash },
            serviceId,
            categoryId,
            clientId: req.clientId,
        });

        if (!gstRateLimitResult.allowed) {
            return res.status(429).json({
                success: false,
                message: gstRateLimitResult.message,
            });
        }

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`GSTIN txn Id ===>> ${tnId}`);

        const maintainanceResponse = await deductCredits(
            req.clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment,
        );

        if (!maintainanceResponse?.result) {
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        const encryptedGst = encryptData(response?.result?.gstinNumber);

        const existingGstin = await gstin_panModel.findOne({ gstinNumber: encryptedGst });

        if (existingGstin) {
            const dataToShow = existingGstin?.result;
            return res.status(200).json(createApiResponse(200, dataToShow, "Valid"));
        }

        const service = await selectService(categoryId, serviceId);

        businessServiceLogger.info(
            `gst inverify activer service ${JSON.stringify(service)}`,
        );

        let response = await GSTtoPANActiveServiceResponse(gstinNumber, service, 0);

        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                gstinNumber: encryptedGst,
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
                status: 1,
                gstinNumber: encryptedGst,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await gstin_verifyModel.create(storingData);
            return res
                .status(200)
                .json(createApiResponse(200, response?.result, "Success"));
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
                clientId: storingClient,
                result: {
                    gstinNumber: gstinNumber,
                    ...findingInValidResponses("gstIn"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 2,
                gstinNumber: encryptedGst,
                response: {
                    gstinNumber: gstinNumber,
                    ...findingInValidResponses("gstIn"),
                },
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await gstin_verifyModel.create(storingData);
            return res
                .status(404)
                .json(createApiResponse(404, { gstinNumber }, "Failed"));
        }
    } catch (error) {
        businessServiceLogger.error(`Error performing GSTIN verification:${error}`);
        return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
    }
};

// GSTIN TAXPAYER
exports.gstInTaxPayerVerification = async (req, res) => {
    const { gstinNumber,
        serviceId = "",
        categoryId = "",
        mobileNumber = "", } = req.body;
    const clientId = req.clientId;
    const isClient = req.role;
    businessServiceLogger.info(
        `GSTIN TAXPAYER VERIFICATION, CLIENTID:${clientId}, SERVICEID:${serviceId}, CATEGORYID:${categoryId}, GSTNO:${gstinNumber}`,
    );
    try {
        if (!gstinNumber) {
            return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
        }
        const capitalGstNumber = gstinNumber?.toUpperCase();

        const isValid = handleValidation("gstin", capitalGstNumber, res);
        if (!isValid) return;

        // 1. HASH THE DATA
        const identifierHash = hashIdentifiers({
            gstNo: capitalGstNumber,
        });

        // 2. CHECK THE RATE LIMIT AND CHECK IS PRODUCT IS SUBSCRIBE
        const gstRateLimitResult = await checkingRateLimit({
            identifiers: { identifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!gstRateLimitResult.allowed) {
            return res.status(429).json(createApiResponse(429, null, gstRateLimitResult?.message))
        };

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`GSTIN TAXPAYER VERIFICATION txnID:${tnId}, CLIENTID:${clientId}`);

        // 3. DEBIT THE WALLET AMOUNT ON THE USEAGE
        const maintainanceResponse = await deductCredits(
            req.clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );
        businessServiceLogger.info(`GSTIN TAXPAYER VERIFICATION txnID:${tnId}, CLIENTID:${clientId}, maintainanceResponse:${JSON.stringify(maintainanceResponse)}`);

        if (!maintainanceResponse?.result) {
            return res.status(500).json(createApiResponse(500, {}, maintainanceResponse?.message || 'Invalid'))
        };

        // 4. CHECK THE DATA IS PRESENT 
        const encryptedGst = encryptData(gstinNumber);

        const existingGstin = await gstInTaxpayer.findOne({ gstinNumber: encryptedGst });

        // 5. UPDATE TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.warn(
                `Analytics update failed for GST Taxpayers verification: client ${clientId}, service ${serviceId}`,
            );
        }

        businessServiceLogger.info(
            `Checked for existing GST Taxpayers record in DB: ${existingGstin ? "Found" : "Not Found"}, `,
        );

        if (existingGstin) {
            if (existingGstin?.status == 1) {
                businessServiceLogger.info(
                    `Returning cached GSTIN Taxpayers response for client: ${clientId}`,
                );

                const decrypted = {
                    ...existingGstin?.response,
                    gstinNumber: gstinNumber,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingGstin?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            } else {
                businessServiceLogger.info(
                    `Returning cached GSTIN Taxpayers response for client: ${clientId}`,
                );
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingGstin?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingGstin?.response;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            }
        }

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);

        businessServiceLogger.info(
            `Active service selected for GSTIN verification: ${service.serviceFor}`,
        );
        if (!service) {
            businessServiceLogger.warn(
                `Active service not found for GSTIN Taxpayers category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }
        businessServiceLogger.info(
            `GSTIN Taxpayers inverify activer service ${JSON.stringify(service)}`,
        );

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
        let response = await GstTaxpayerActiveServiceResponse(gstinNumber, service, 0);
        businessServiceLogger.info(
            `Response received from active service ${service.serviceFor}: ${response?.message}`,
        );

        // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                gstinNumber: encryptedGst,
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
                gstinNumber: encryptedGst,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await gstInTaxpayer.create(storingData);
            businessServiceLogger.info(
                `Valid GSTIN Taxpayer response stored and sent to client: ${clientId}`,
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
                    gstinNumber: gstinNumber,
                    // ...findingInValidResponses("gstin"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 2,
                gstinNumber: encryptedGst,
                response: {
                    gstinNumber: gstinNumber,
                    // ...findingInValidResponses("gstin"),
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await gstInTaxpayer.create(storingData);
            businessServiceLogger.info(
                `Invalid GSTIN TaxPayers response received and sent to client: ${clientId}`,
            );
            return res
                .status(404)
                .json(createApiResponse(404, { gstinNumber: gstinNumber }, "Failed"));
        }


    } catch (error) {
        businessServiceLogger.info(
            `GSTIN TAXPAYER VERIFICATION, GSTNO:${gstinNumber}, ERRORMESSAGE;${error.message}`,
        );
        return res.status(500).json(createApiResponse(500, null, 'SERVER ERROR'));
    }
}

// CIN VERIFICATION
exports.handleCINVerification = async (req, res, next) => {
    const { CIN, mobileNumber = "", serviceId = "", categoryId = "" } = req.body;
    const isCinValid = handleValidation("cin", CIN, res);
    if (!isCinValid) return;

    console.log("All inputs are valid, continue processing...");

    const storingClient = req.clientId || clientId;

    const identifierHash = hashIdentifiers({
        panNo: capitalPanNumber,
    });

    const cinRateLimitResult = await checkingRateLimit({
        identifiers: { identifierHash },
        serviceId,
        categoryId,
        clientId: storingClient,
    });

    if (!cinRateLimitResult.allowed) {
        return res.status(429).json({
            success: false,
            message: cinRateLimitResult.message,
        });
    }

    const tnId = genrateUniqueServiceId();
    businessServiceLogger.info(`pan txn Id ===>> ${tnId}`);
    let maintainanceResponse;
    if (req.environment?.toLowerCase() == "test") {
        maintainanceResponse = await creditsToBeDebited(
            storingClient,
            serviceId,
            categoryId,
            tnId,
        );
    } else {
        maintainanceResponse = await chargesToBeDebited(
            storingClient,
            serviceId,
            categoryId,
            tnId,
        );
    }

    if (!maintainanceResponse?.result) {
        return res.status(500).json({
            success: false,
            message: "InValid",
            response: {},
        });
    }

    const cinDetails = await IncorporationCertificateModel.findOne({
        cinNumber: CIN,
    });
    console.log("is cin details is present", cinDetails);

    const analyticsResult = await AnalyticsDataUpdate(
        storingClient,
        serviceId,
        categoryId,
    );
    if (!analyticsResult.success) {
        businessServiceLogger.info(
            `Analytics update failed for Penny Drop: client ${storingClient}, service ${serviceId}`,
        );
    }

    if (cinDetails) {
        await responseModel.create({
            serviceId,
            categoryId,
            clientId: storingClient,
            result: cinDetails?.response?.result,
            createdTime: new Date().toLocaleTimeString(),
            createdDate: new Date().toLocaleDateString(),
        });
        return res
            .status(200)
            .json(createApiResponse(200, cinDetails?.response?.result, "Valid"));
    }

    const service = await selectService(categoryId, serviceId);

    businessServiceLogger.info("----active service for cin Verify is ----", service);

    try {
        let response = await CinActiveServiceResponse(CIN, service, 0);

        console.log("API Response:", response);
        businessServiceLogger.info(
            "----API Response from active service of cin is ----",
            response,
        );

        if (response?.message?.toUpperCase() == "VALID") {
            const companyDetails = response;
            console.log("companyDetails===>", companyDetails);
            if (!companyDetails) {
                let errorMessage = {
                    message: "Invalid response structure: Missing company details",
                    statusCode: 400,
                };
                return next(errorMessage);
            }
            await responseModel.create({
                serviceId,
                categoryId,
                clientId: storingClient,
                result: companyDetails,
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const newCinVerification = await IncorporationCertificateModel.create({
                response: companyDetails,
                status: 1,
                cinNumber: CIN,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            });

            console.log("Data saved to MongoDB:", newCinVerification);
            res
                .status(200)
                .json({ message: "Valid", data: response?.result, success: true });
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
                clientId: storingClient,
                result: {},
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const newCinVerification = await IncorporationCertificateModel.create({

                response: {},
                status: 2,
                cinNumber: CIN,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            });

            console.log("Data saved to MongoDB:", newCinVerification);
            res.status(200).json({
                message: "InValid",
                data: {
                    CinNUmber: CIN,
                    ...findingInValidResponses("cin"),
                },
                success: false,
            });
        }
    } catch (error) {
        console.error("Error performing company verification:", error.message);

        let errorMessage = {
            message: "Failed to perform company verification",
            statusCode: 400,
        };
        return next(errorMessage);
    }
};
