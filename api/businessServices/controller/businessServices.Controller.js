const { deductCredits } = require("../../../services/CreditService.js");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring.js");
const { createApiResponse } = require("../../../utils/ApiResponseHandler.js");
const checkingRateLimit = require("../../../utils/checkingRateLimit.js");
const { encryptData } = require("../../../utils/EncryptAndDecrypt.js");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes.js");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId.js");
const { hashIdentifiers } = require("../../../utils/hashIdentifier.js");
const { businessServiceLogger } = require("../../Logger/logger.js");
const { selectService } = require("../../service/serviceSelector.js");
const responseModel = require("../../serviceResponses/model/serviceResponseModel.js");
const gstin_verifyModel = require("../module/gstin_verify.model.js");
const gstInTaxpayer = require("../module/gstin_taxpayer.model.js")
const gstin_panModel = require("../module/gstin_pan.model.js");
const din_verifyModel = require('../module/dinModel.js');
const tin_verifyModel = require('../module/tin.model.js');
const iec_Verification = require('../module/iecModel.js');
const lei_Verification = require('../module/lei.model.js');
const UAM_verifyModel = require('../module/uam.model.js');
const cinCompanyVerification = require('../module/cinCompany.model.js');
const companyLIstVerification = require('../module/companyList.model.js');
const dgft_verification = require('../module/Dgft.model.js');
const IncorporationCertificateModel = require("../module/IncorporationCertificateModel.js");
const { response } = require("express");
const handleValidation = require("../../../utils/lengthCheck.js");
const { CinActiveServiceResponse } = require("../service/CinServiceResponse.js");
const { DinActiveServiceResponse } = require("../service/dinServiceResponse.js");
const { GstTaxpayerActiveServiceResponse } = require("../service/gstinTaxpayerServiceResp.js");
const { GSTtoPANActiveServiceResponse,
    GSTActiveServiceResponse } = require("../service/GstServiceResponse.js");
const { findingInValidResponses } = require("../../../utils/InvalidResponses.js");
const { IecActiveServiceResponse } = require("../service/iecServiceResp.js");
const { udyamActiveServiceResponse } = require("../service/UdyamServiceResponse.js");
const udhyamVerify = require("../module/udyamModel.js");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds.js");
const { DGFTActiveServiceResponse } = require("../service/DFGTServiceResponse.js");
const { shopActiveServiceResponse } = require("../service/ShopResponse.js");
const shopestablishmentModel = require("../module/shopestablishment.model.js");

// DIN VERIFICATION
exports.dinVerification = async (req, res) => {
    const { dinNumber, mobileNumber = "" } = req.body;
    const clientId = req.clientId;

    if (!dinNumber) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }
    businessServiceLogger.info(`DIN NUMBER Details: ${dinNumber}`);
    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('DIN', clientId);

        const isValid = handleValidation("din", dinNumber, res, clientId);
        if (!isValid) return;

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
            businessServiceLogger.info(`[FAILED]: Rate limit exceeded for DIN verification: client ${clientId}, service ${serviceId}`);
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
            businessServiceLogger.info(`[FAILED]: Credit deduction failed for DIN verification: client ${clientId}, txnId ${tnId}`);
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
            businessServiceLogger.info(
                `[FAILED]: Analytics update failed for DIN verification: client ${clientId}, service ${serviceId}`,
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
            businessServiceLogger.info(
                `[FAILED]: Active service not found for DIN category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }
        businessServiceLogger.info(
            `Active service selected for DIN verification: ${service.serviceFor}`,
        );

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
        let response = await DinActiveServiceResponse(dinNumber, service, 0);

        businessServiceLogger.info(
            `Active service selected for DINverification service ${service.serviceFor}: ${response?.message}`,
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
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

// GST IN VERIFY
exports.gstinverify = async (req, res, next) => {
    const {
        gstinNumber,
        mobileNumber = "",
    } = req.body;
    const clientId = req.clientId;

    if (!gstinNumber) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }
    businessServiceLogger.info(`GSTIN NUMBER Details: ${gstinNumber}`);
    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('GSTIN', clientId);

        const capitalGstNumber = gstinNumber?.toUpperCase();
        const isValid = handleValidation("gstin", capitalGstNumber, res, clientId);
        if (!isValid) return;

        businessServiceLogger.info(
            `Executing GSTIN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
        );

        //1. HASH DIN NUMBER
        const identifierHash = hashIdentifiers({
            gstNo: capitalGstNumber,
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const gstRateLimitResult = await checkingRateLimit({
            identifiers: { identifierHash },
            serviceId,
            categoryId,
            clientId: clientId,
        });

        if (!gstRateLimitResult.allowed) {
            businessServiceLogger.info(`[FAILED]: Rate limit exceeded for GSTIN verification: client ${clientId}, service ${serviceId}`);
            return res.status(429).json({
                success: false,
                message: gstRateLimitResult.message,
            });
        }

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated GSTIN txn Id: ${tnId}`);

        // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.error(`[FAILED]: Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        // 4. CHECK IN THE DB IS DATA PRESENT
        const encryptedGst = encryptData(gstinNumber);

        // Check if the record is present in the DB
        const existingGstin = await gstin_verifyModel.findOne({
            gstinNumber: encryptedGst,
        });

        // 5. UPDATE TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.info(
                `[FAILED]: Analytics update failed for GSTIN verification: client ${clientId}, service ${serviceId}`,
            );
        }

        businessServiceLogger.info(
            `Checked for existing GSTIN record in DB: ${existingGstin ? "Found" : "Not Found"}`,
        );

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
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

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);
        if (!service) {
            businessServiceLogger.info(
                `[FAILED]: Active service not found for GSTIN category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }

        businessServiceLogger.info(
            `Active service selected for GSTIN verification: ${service.serviceFor}`,
        );

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
        let response = await GSTActiveServiceResponse(gstinNumber, service, 0);
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
        mobileNumber = "",
    } = req.body;
    const clientId = req.clientId;

    if (!gstinNumber) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }
    businessServiceLogger.info(`gstin NUMBER Details: ${gstinNumber}`);
    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('GSTINTOPAN', clientId);

        const capitalGstNumber = gstinNumber?.toUpperCase();
        const isValid = handleValidation("gstin", capitalGstNumber, res, clientId);
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
    if (!gstinNumber) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }
    businessServiceLogger.info(
        `GSTIN TAXPAYER VERIFICATION, CLIENTID:${clientId}, SERVICEID:${serviceId}, CATEGORYID:${categoryId}, GSTNO:${gstinNumber}`,
    );
    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('GSTINTAXPAYER', clientId);
        const capitalGstNumber = gstinNumber?.toUpperCase();

        const isValid = handleValidation("gstin", capitalGstNumber, res, clientId);
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
                    ...findingInValidResponses("gstin"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 2,
                gstinNumber: encryptedGst,
                response: {
                    gstinNumber: gstinNumber,
                    ...findingInValidResponses("gstin"),
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
};

// CIN DOC:15 VERIFICATION (CIN Search)
exports.handleCINVerification = async (req, res, next) => {
    const { CIN, mobileNumber = "" } = req.body;
    const clientId = req.clientId;

    if (!CIN) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    };

    businessServiceLogger.info(`CIN NUMBER Details: ${CIN}`);
    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('CIN', clientId);

        const isCinValid = handleValidation("cin", CIN, res, clientId);
        if (!isCinValid) return;

        businessServiceLogger.info(
            `Executing CIN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
        );

        //1. HASH DIN NUMBER
        const identifierHash = hashIdentifiers({
            CIN
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const cinRateLimitResult = await checkingRateLimit({
            identifiers: { identifierHash },
            serviceId,
            categoryId,
            clientId,
        });

        if (!cinRateLimitResult.allowed) {
            businessServiceLogger.info(`[FAILED]: Rate limit exceeded for CIN verification: client ${clientId}, service ${serviceId}`);
            return res.status(429).json({
                success: false,
                message: cinRateLimitResult.message,
            });
        }

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated CIN txn Id: ${tnId}`);

        // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.info(`[FAILED]: Credit deduction failed for DIN verification: client ${clientId}, txnId ${tnId}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        // 4. CHECK IN THE DB IS DATA PRESENT 
        const encryptedCIN = encryptData(CIN);

        const existingCIN = await IncorporationCertificateModel.findOne({
            cinNumber: encryptedCIN,
        });

        // 5. UPDATE TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.info(
                `[FAILED]:  Analytics update failed for CIN verification: client ${storingClient}, service ${serviceId}`,
            );
        }

        businessServiceLogger.info(
            `Checked for existing CIN record in DB: ${existingCIN ? "Found" : "Not Found"}, `,
        );

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingCIN) {
            if (existingCIN?.status == 1) {
                businessServiceLogger.info(
                    `Returning cached CIN response for client: ${clientId}`,
                );

                const decrypted = {
                    ...existingCIN?.response,
                    cinNumber: CIN,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingCIN?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            } else {
                businessServiceLogger.info(
                    `Returning cached Cin response for client: ${clientId}`,
                );
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingCIN?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingCIN?.response;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            }
        }

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);

        if (!service) {
            businessServiceLogger.info(
                `[FAILED]: Active service not found for CIN category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };

        businessServiceLogger.info(
            `Active service selected for CIN verification: ${service.serviceFor}`
        );

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
        let response = await CinActiveServiceResponse(CIN, service, 'CinApiCall', 0);

        businessServiceLogger.info(
            `Active service selected for CINverification service ${service.serviceFor}: ${response?.message}`,
        );

        // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                cinNumber: encryptedCIN,
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
                cinNumber: encryptedCIN,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await IncorporationCertificateModel.create(storingData);
            businessServiceLogger.info(
                `Valid CIN response stored and sent to client: ${clientId}`
            );
            return res
                .status(200)
                .json(createApiResponse(200, response?.result, "Success"));

        } else {
            await responseModel.create({
                serviceId,
                categoryId,
                clientId: storingClient,
                result: {
                    cinNumber: CIN,
                    ...findingInValidResponses("Cin"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });

            const storingData = {
                status: 2,
                cinNumber: encryptedCIN,
                response: {
                    cinNumber: CIN,
                    ...findingInValidResponses("Cin"),
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            }

            await IncorporationCertificateModel.create(storingData);

            businessServiceLogger.info(
                `Invalid CIN response received and sent to client: ${clientId}`
            );
            return res.status(404).json(createApiResponse(404, { CinNUmber: CIN }, 'Failed'));
        }
    } catch (error) {
        businessServiceLogger.error(
            `System error in CIN verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

// CIN DOC:382 VERIFICATION (CINCompany List)
exports.CompanVerification = async (req, res, next) => {
    const { CompanyName, mobileNumber = "" } = req.body;
    const clientId = req.clientId;

    if (!CompanyName) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    };

    businessServiceLogger.info(`CompanyName List Details: ${CompanyName}`);
    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('CompanyNamelist', clientId);

        const isCompanyNameValid = handleValidation("CompanyName", CompanyName, res, clientId);
        if (!isCompanyNameValid) return;

        businessServiceLogger.info(
            `Executing CompanyName list verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
        );

        //1. HASH DIN NUMBER
        const identifierHash = hashIdentifiers({
            CompanyName
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const CompanyNameRateLimitResult = await checkingRateLimit({
            identifiers: { identifierHash },
            serviceId,
            categoryId,
            clientId,
        });

        if (!CompanyNameRateLimitResult.allowed) {
            businessServiceLogger.info(`[FAILED]: Rate limit exceeded for CompanyName list verification: client ${clientId}, service ${serviceId}`);
            return res.status(429).json({
                success: false,
                message: CompanyNameRateLimitResult.message,
            });
        }

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated CompanyName txn Id: ${tnId}`);

        // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.info(`[FAILED]: Credit deduction failed for CompanyName list verification: client ${clientId}, txnId ${tnId}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        // 4. CHECK IN THE DB IS DATA PRESENT 
        const encryptedCompanyName = encryptData(CompanyName);

        const existingCompanyName = await companyLIstVerification.findOne({
            CompanyName: encryptedCompanyName,
        });

        // 5. UPDATE TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.info(
                `[FAILED]:  Analytics update failed for CompanyName list verification: client ${storingClient}, service ${serviceId}`,
            );
        }

        businessServiceLogger.info(
            `Checked for existing CompanyName list record in DB: ${existingCompanyName ? "Found" : "Not Found"}, `,
        );

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingCompanyName) {
            if (existingCompanyName?.status == 1) {
                businessServiceLogger.info(
                    `Returning cached CompanyName list response for client: ${clientId}`,
                );

                const decrypted = {
                    ...existingCompanyName?.response,
                    CompanyName,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingCompanyName?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            } else {
                businessServiceLogger.info(
                    `Returning cached CompanyName list response for client: ${clientId}`,
                );
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingCompanyName?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingCompanyName?.response;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            }
        }

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);

        if (!service) {
            businessServiceLogger.info(
                `[FAILED]: Active service not found for CompanyName list category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };

        businessServiceLogger.info(
            `Active service selected for CompanyName verification: ${service.serviceFor}`
        );

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
        let response = await CinActiveServiceResponse(CIN, service, 'CompanyListApiCall', 0);

        businessServiceLogger.info(
            `Active service selected for CompanyName list verification service ${service.serviceFor}: ${response?.message}`,
        );

        // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                CompanyName: encryptedCompanyName,
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
                CompanyName: encryptedCompanyName,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await companyLIstVerification.create(storingData);
            businessServiceLogger.info(
                `Valid CompanyName list response stored and sent to client: ${clientId}`
            );
            return res
                .status(200)
                .json(createApiResponse(200, response?.result, "Success"));

        } else {
            await responseModel.create({
                serviceId,
                categoryId,
                clientId: storingClient,
                result: {
                    CompanyName: CompanyName,
                    ...findingInValidResponses("CompanyName"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });

            const storingData = {
                status: 2,
                CompanyName: encryptedCompanyName,
                response: {
                    CompanyName: CompanyName,
                    ...findingInValidResponses("CompanyName"),
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            }

            await companyLIstVerification.create(storingData);

            businessServiceLogger.info(
                `Invalid CompanyName list response received and sent to client: ${clientId}`
            );
            return res.status(404).json(createApiResponse(404, { CompanyName: CompanyName }, 'Failed'));
        }
    } catch (error) {
        businessServiceLogger.error(
            `System error in CompanyName list verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

// CIN DOC:52 VERIFICATION (company to CIN Search)
exports.CompanVerification = async (req, res, next) => {
    const { CompanyName, mobileNumber = "" } = req.body;
    const clientId = req.clientId;

    if (!CompanyName) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    };

    businessServiceLogger.info(`CompanyName Details: ${CompanyName}`);
    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('CompanyName', clientId);

        const isCompanyNameValid = handleValidation("CompanyName", CompanyName, res, clientId);
        if (!isCompanyNameValid) return;

        businessServiceLogger.info(
            `Executing CompanyName verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
        );

        //1. HASH DIN NUMBER
        const identifierHash = hashIdentifiers({
            CompanyName
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const CompanyNameRateLimitResult = await checkingRateLimit({
            identifiers: { identifierHash },
            serviceId,
            categoryId,
            clientId,
        });

        if (!CompanyNameRateLimitResult.allowed) {
            businessServiceLogger.info(`[FAILED]: Rate limit exceeded for CompanyName verification: client ${clientId}, service ${serviceId}`);
            return res.status(429).json({
                success: false,
                message: CompanyNameRateLimitResult.message,
            });
        }

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated CompanyName txn Id: ${tnId}`);

        // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.info(`[FAILED]: Credit deduction failed for CompanyName verification: client ${clientId}, txnId ${tnId}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        // 4. CHECK IN THE DB IS DATA PRESENT 
        const encryptedCompanyName = encryptData(CompanyName);

        const existingCompanyName = await cinCompanyVerification.findOne({
            CompanyName: encryptedCompanyName,
        });

        // 5. UPDATE TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.info(
                `[FAILED]:  Analytics update failed for CompanyName verification: client ${storingClient}, service ${serviceId}`,
            );
        }

        businessServiceLogger.info(
            `Checked for existing CompanyName record in DB: ${existingCompanyName ? "Found" : "Not Found"}, `,
        );

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingCompanyName) {
            if (existingCompanyName?.status == 1) {
                businessServiceLogger.info(
                    `Returning cached CompanyName list response for client: ${clientId}`,
                );

                const decrypted = {
                    ...existingCompanyName?.response,
                    CompanyName,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingCompanyName?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            } else {
                businessServiceLogger.info(
                    `Returning cached CompanyName list response for client: ${clientId}`,
                );
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingCompanyName?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingCompanyName?.response;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            }
        }

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);

        if (!service) {
            businessServiceLogger.info(
                `[FAILED]: Active service not found for CompanyName list category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };

        businessServiceLogger.info(
            `Active service selected for CompanyName verification: ${service.serviceFor}`
        );

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
        let response = await CinActiveServiceResponse(CIN, service, 'CompanySearchApiCall', 0);

        businessServiceLogger.info(
            `Active service selected for CompanyName list verification service ${service.serviceFor}: ${response?.message}`,
        );

        // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                CompanyName: encryptedCompanyName,
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
                CompanyName: encryptedCompanyName,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await cinCompanyVerification.create(storingData);
            businessServiceLogger.info(
                `Valid CompanyName list response stored and sent to client: ${clientId}`
            );
            return res
                .status(200)
                .json(createApiResponse(200, response?.result, "Success"));

        } else {
            await responseModel.create({
                serviceId,
                categoryId,
                clientId: storingClient,
                result: {
                    CompanyName: CompanyName,
                    ...findingInValidResponses("CompanyName"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });

            const storingData = {
                status: 2,
                CompanyName: encryptedCompanyName,
                response: {
                    CompanyName: CompanyName,
                    ...findingInValidResponses("CompanyName"),
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            }

            await cinCompanyVerification.create(storingData);

            businessServiceLogger.info(
                `Invalid CompanyName list response received and sent to client: ${clientId}`
            );
            return res.status(404).json(createApiResponse(404, { CompanyName: CompanyName }, 'Failed'));
        }
    } catch (error) {
        businessServiceLogger.error(
            `System error in CompanyName list verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

// TIN VERIFICATION
exports.handleTINVerification = async (req, res) => {

    const { TIN, mobileNumber = "" } = req.body;
    const clientId = req.clientId;

    if (!TIN) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }

    businessServiceLogger.info(`TIN Number Details: ${TIN}`);
    try {

        const { categoryId, serviceId } = await getCategoryIdAndServiceId('TIN', clientId);

        businessServiceLogger.info(
            `Executing TIN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
        );

        //1. HASH TIN NUMBER
        const indetifierHash = hashIdentifiers({
            TIN
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const tinRateLimitResult = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!tinRateLimitResult.allowed) {
            businessServiceLogger.warn(`Rate limit exceeded for TIN verification: client ${clientId}, service ${serviceId}`);
            return res.status(429).json({
                success: false,
                message: tinRateLimitResult.message,
            });
        };

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated TIN txn Id: ${tnId}`);

        // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.error(`Credit deduction failed for TIN verification: client ${clientId}, txnId ${tnId}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        // 4. CHECK IN THE DB IS DATA PRESENT 
        const encryptedtTIN = encryptData(TIN);

        const existingTin = await tin_verifyModel.findOne({ tinNumber: encryptedtTIN })

        // 5. UPDATE TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.warn(
                `Analytics update failed for TIN verification: client ${clientId}, service ${serviceId}`,
            );
        }

        businessServiceLogger.info(
            `Checked for existing TIN record in DB: ${existingTin ? "Found" : "Not Found"}, `,
        );

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingTin) {
            if (existingTin?.status == 1) {
                businessServiceLogger.info(
                    `Returning cached TIN response for client: ${clientId}`,
                );

                const decrypted = {
                    ...existingTin?.response,
                    tinNumber: tinNumber,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingTin?.response,
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
                    result: existingTin?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingTin?.response;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            }
        };

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);
        if (!service) {
            businessServiceLogger.warn(
                `Active service not found for TIN category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
        let response = await DinActiveServiceResponse(tinNumber, service, 0);
        businessServiceLogger.info(
            `Response received from active service ${service.serviceFor}: ${response?.message}`,
        );

        businessServiceLogger.info(
            `Active service selected for TIN verification: ${service.serviceFor}`,
        );

        // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                tinNumber: encryptedtTIN,
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
                tinNumber: encryptedtTIN,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await tin_verifyModel.create(storingData);
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
                    tinNumber: tinNumber,
                    // ...findingInValidResponses("Tin"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 2,
                tinNumber: encryptedtTIN,
                response: {
                    tinNumber: tinNumber,
                    // ...findingInValidResponses("Tin"),
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await tin_verifyModel.create(storingData);
            businessServiceLogger.info(
                `Invalid TIN response received and sent to client: ${clientId}`,
            );
            return res
                .status(404)
                .json(createApiResponse(404, { tinNumber: tinNumber }, "Failed"));
        }

    } catch (error) {
        businessServiceLogger.error(
            `System error in TIN verification for client ${clientId}: ${error.message}`,
            error,
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

//IEC VERIFICATION
exports.handleIECVerification = async (req, res) => {
    const { IEC, mobileNumber = "" } = req.body;
    const clientId = req.clientId;

    if (!IEC) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }

    businessServiceLogger.info(`IEC Number Details: ${IEC}`);
    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('IEC', clientId);
        businessServiceLogger.info(`Executing IEC verfication for client:${clientId}, service: ${serviceId}, category: ${categoryId}`)

        //1. HASH IEC NUMBER
        const indetifierHash = hashIdentifiers({ iecNumber: IEC });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const iecRateLimitResult = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!iecRateLimitResult.allowed) {
            businessServiceLogger.warn(`Rate limit exceeded for IEC verfication: client ${clientId}, service ${serviceId}`)
            return res.status(429).json({
                success: false,
                message: iecRateLimitResult?.message
            })
        };

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated IEC txn Id: ${tnId}`);

        // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.error(`Credit deducation failed for IEC verification: client ${clientId}, txnId ${tnId}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || 'Invalid',
                response: {}
            })
        };

        // 4. CHECK IN THE DB IS DATA PRESENT
        const encryptedIEC = encryptData(IEC);

        const existingIEC = await iec_Verification.findOne({
            iecNumber: encryptedIEC
        });

        // 5. UPDATE TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );

        if (!analyticsResult?.success) {
            businessServiceLogger.warn(
                `Analytics update failed for IEC verification: clientId ${clientId}, service ${serviceId}`
            )
        };

        businessServiceLogger.info(
            `checked for existing IEC record in DB:${existingIEC ? "Found" : "Not Found"} `
        )

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingIEC) {
            if (existingIEC?.status == 1) {
                businessServiceLogger.info(
                    `Returning cached IEC response for client:${clientId}`
                );
                const decrypted = {
                    ...existingIEC?.response,
                    iecNumber: IEC
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingIEC?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res.status(200).json(createApiResponse(200, dataToShow, 'valid'));
            } else {
                businessServiceLogger.info(
                    `Returning cached IEC response for client: ${clientId}`,
                );
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingIEC?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingIEC?.response;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            }
        };

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);
        if (!service) {
            businessServiceLogger.warn(
                `Active service not found for IEC category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
        let response = await IecActiveServiceResponse(IEC, service, 0);
        businessServiceLogger.info(
            `Response received from active service ${service.serviceFor}: ${response?.message}`,
        );

        businessServiceLogger.info(
            `Active service selected for IEC verification: ${service.serviceFor}`,
        );

        // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                iecNumber: encryptedIEC,
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
                iecNumber: encryptedIEC,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await iec_Verification.create(storingData);
            businessServiceLogger.info(
                `Valid IEC response stored and sent to client: ${clientId}`,
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
                    iecNumber: IEC,
                    // ...findingInValidResponses("Iec"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 2,
                iecNumber: encryptedIEC,
                response: {
                    iecNumber: IEC,
                    // ...findingInValidResponses("Iec"),
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await iec_Verification.create(storingData);
            businessServiceLogger.info(
                `Invalid IEC response received and sent to client: ${clientId}`,
            );
            return res
                .status(404)
                .json(createApiResponse(404, { existingIEC: existingIEC }, "Failed"));
        }


    } catch (error) {
        businessServiceLogger.error(
            `System error in IEC verification for client ${clientId}: ${error.message}`,
            error,
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
}

// UDYAMNUMBER VERIFICATION
exports.udyamNumberVerfication = async (req, res, next) => {
    const {
        udyamNumber,
        mobileNumber = ""
    } = req.body;

    const storingClient = req.clientId;
    businessServiceLogger.info(`udyamNumber from request ===> ${udyamNumber} for this client: ${storingClient}`);

    const capitalUdyamNumber = udyamNumber?.toUpperCase();
    const isValid = handleValidation("udyam", capitalUdyamNumber, res, storingClient);
    if (!isValid) return;

    businessServiceLogger.info(
        `All inputs in udyam are valid, continue processing... for this client: ${storingClient}`,
    );

    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('UDYAMNUMBER', clientId);
        businessServiceLogger.info(
            `Executing Udyam verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
        );

        const identifierHash = hashIdentifiers({
            udyamNo: capitalUdyamNumber,
        });

        const udyamRateLimitResult = await checkingRateLimit({
            identifiers: { identifierHash },
            serviceId,
            categoryId,
            clientId: storingClient,
        });

        if (!udyamRateLimitResult.allowed) {
            businessServiceLogger.warn(
                `Rate limit exceeded for Udyam verification: client ${storingClient}, service ${serviceId}`,
            );
            return res.status(429).json({
                success: false,
                message: udyamRateLimitResult.message,
            });
        }

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated Udyam txn Id: ${tnId}`);

        const maintainanceResponse = await deductCredits(
            storingClient,
            serviceId,
            categoryId,
            tnId,
            req.environment,
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.error(
                `Credit deduction failed for Udyam verification: client ${storingClient}, txnId ${tnId}`,
            );
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        const encryptedUdhyam = encryptData(capitalUdyamNumber);
        businessServiceLogger.debug(`Encrypted Udyam number for DB lookup`);

        const existingUdhyamNumber = await udhyamVerify.findOne({
            udyamNumber: encryptedUdhyam,
        });

        // Note: AnalyticsDataUpdate was missing in this controller, adding it for consistency
        const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
        const analyticsResult = await AnalyticsDataUpdate(
            storingClient,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.warn(
                `Analytics update failed for Udyam verification: client ${storingClient}, service ${serviceId}`,
            );
        }

        businessServiceLogger.debug(
            `Checked for existing Udyam record in DB: ${existingUdhyamNumber ? "Found" : "Not Found"}`,
        );

        if (existingUdhyamNumber) {
            if (existingUdhyamNumber?.status == 1) {
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId: storingClient,
                    result: existingUdhyamNumber?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                businessServiceLogger.info(
                    `Returning cached valid Udyam response for client: ${storingClient}`,
                );
                return res
                    .status(200)
                    .json(
                        createApiResponse(200, existingUdhyamNumber?.response, "Valid"),
                    );
            } else {
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId: storingClient,
                    result: {
                        ...findingInValidResponses("udyam"),
                        udyam: udyamNumber,
                    },
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                businessServiceLogger.info(
                    `Returning cached invalid Udyam response for client: ${storingClient}`,
                );
                return res.status(200).json(
                    createApiResponse(
                        200,
                        {
                            ...findingInValidResponses("udyam"),
                            udyam: udyamNumber,
                        },
                        "InValid",
                    ),
                );
            }
        }

        const service = await selectService(categoryId, serviceId);
        if (!service) {
            businessServiceLogger.warn(
                `Active service not found for Udyam category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }

        businessServiceLogger.info(
            `Active service selected for Udyam verification: ${service.serviceFor}`,
        );
        let udyamResponse = await udyamActiveServiceResponse(
            udyamNumber,
            service,
            0,
            storingClient,
        );

        businessServiceLogger.info(
            `Response received from udyam verification active service ${udyamResponse?.service}: ${response?.message}`,
        );

        if (udyamResponse?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...udyamResponse?.result,
                udyam: encryptedUdhyam,
            };

            const storingData = {
                response: encryptedResponse,
                serviceResponse: udyamResponse?.responseOfService,
                status: 1,
                serviceName: udyamResponse?.service,
                ...(mobileNumber && { mobileNumber }),
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            const existingOrNew = await udhyamVerify.findOneAndUpdate(
                { udyamNumber: encryptedUdhyam },
                { $setOnInsert: storingData },
                { upsert: true, new: true },
            );
            businessServiceLogger.info(
                `Valid Udyam response stored and sent to client: ${storingClient}`,
            );
            return res
                .status(200)
                .json(createApiResponse(200, existingOrNew.response, "Valid"));
        } else {
            const InValidData = {
                response: {
                    ...findingInValidResponses("udyam"),
                    udyam: udyamNumber,
                },
                serviceResponse: {},
                status: 2,
                serviceName: udyamResponse?.service,
                ...(mobileNumber && { mobileNumber }),
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await udhyamVerify.findOneAndUpdate(
                { udyamNumber: encryptedUdhyam },
                { $setOnInsert: InValidData },
                { upsert: true, new: true },
            );

            businessServiceLogger.info(
                `Invalid Udyam response received and sent to client: ${storingClient}`,
            );
            return res.status(404).json(
                createApiResponse(
                    404,
                    {
                        ...findingInValidResponses("udyam"),
                        udyam: udyamNumber,
                    },
                    "InValid",
                ),
            );
        }
    } catch (error) {
        businessServiceLogger.error(
            `System error in Udyam verification for client ${storingClient}: ${error.message}`,
            error,
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

// DGFT  VERIFICATION
exports.DGFTVerification = async (req, res) => {
    const { DGFT, mobileNumber = "" } = req.body;
    const clientId = req.clientId;

    if (!DGFT) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }
    businessServiceLogger.info(`DGFT NUMBER Details: ${DGFT}`);
    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('DGFT', clientId);

        const isValid = handleValidation("DGFT", DGFT, res, clientId);
        if (!isValid) return;

        businessServiceLogger.info(
            `Executing DGFT verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
        );

        //1. HASH DGFT NUMBER
        const indetifierHash = hashIdentifiers({
            DGFT: DGFT
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const DGFTRateLimitResult = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!DGFTRateLimitResult.allowed) {
            businessServiceLogger.info(`[FAILED]: Rate limit exceeded for DGFT verification: client ${clientId}, service ${serviceId}`);
            return res.status(429).json({
                success: false,
                message: DGFTRateLimitResult.message,
            });
        };

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated DGFT txn Id: ${tnId}`);

        // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.info(`[FAILED]: Credit deduction failed for DGFT verification: client ${clientId}, txnId ${tnId}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        // 4. CHECK IN THE DB IS DATA PRESENT 
        const encryptedDGFT = encryptData(DGFT);

        const existingDGFT = await dgft_verification.findOne({ DGFT: DGFT })

        // 5. UPDATE TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.info(
                `[FAILED]: Analytics update failed for DGFT verification: client ${clientId}, service ${serviceId}`,
            );
        }

        businessServiceLogger.info(
            `Checked for existing DGFT record in DB: ${existingDGFT ? "Found" : "Not Found"}, `,
        );

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingDGFT) {
            if (existingDGFT?.status == 1) {
                businessServiceLogger.info(
                    `Returning cached DGFT response for client: ${clientId}`,
                );

                const decrypted = {
                    ...existingDGFT?.response,
                    DGFT: DGFT,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingDGFT?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            } else {
                businessServiceLogger.info(
                    `Returning cached DGFT response for client: ${clientId}`,
                );
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingDGFT?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingDGFT?.response;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            }
        }

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);
        if (!service) {
            businessServiceLogger.info(
                `[FAILED]: Active service not found for DGFT category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }
        businessServiceLogger.info(
            `Active service selected for DGFT verification: ${service.serviceFor}`,
        );

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
        let response = await DGFTActiveServiceResponse(DGFT, service, 0);

        businessServiceLogger.info(
            `Active service selected for DGFT service ${service.serviceFor}: ${response?.message}`,
        );

        // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                DGFT: encryptedDGFT,
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
                DGFT: encryptedDGFT,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await dgft_verification.create(storingData);
            businessServiceLogger.info(
                `Valid DGFT response stored and sent to client: ${clientId}`,
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
                    DGFT: DGFT,
                    ...findingInValidResponses("DGFT"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 2,
                DGFT: encryptedDGFT,
                response: {
                    DGFT: DGFT,
                    ...findingInValidResponses("DGFT"),
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await dgft_verification.create(storingData);
            businessServiceLogger.info(
                `Invalid DGFT response received and sent to client: ${clientId}`,
            );
            return res
                .status(404)
                .json(createApiResponse(404, { DGFT: DGFT }, "Failed"));
        }

    } catch (error) {
        businessServiceLogger.error(
            `System error in DGFT verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

// LEI VERIFICATION
exports.LEIVerification = async (req, res) => {
    const { CompanyName, mobileNumber = "" } = req.body;
    const clientId = req.clientId;
    if (!CompanyName) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }
    businessServiceLogger.info(`LEI NUMBER Details: ${CompanyName}`);
    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('LEI', clientId);

        const isValid = handleValidation("LEI", CompanyName, res, clientId);
        if (!isValid) return;

        businessServiceLogger.info(
            `Executing LEI verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
        );

        //1. HASH LEI NUMBER
        const indetifierHash = hashIdentifiers({
            CompanyName: CompanyName
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const LEIRateLimitResult = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!LEIRateLimitResult.allowed) {
            businessServiceLogger.info(`[FAILED]: Rate limit exceeded for LEI verification: client ${clientId}, service ${serviceId}`);
            return res.status(429).json({
                success: false,
                message: LEIRateLimitResult.message,
            });
        };

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated LEI txn Id: ${tnId}`);

        // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.info(`[FAILED]: Credit deduction failed for LEI verification: client ${clientId}, txnId ${tnId}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        // 4. CHECK IN THE DB IS DATA PRESENT 
        const encryptedLEI = encryptData(CompanyName);

        const existingLEI = await lei_Verification.findOne({ CompanyName: encryptedLEI })

        // 5. UPDATE TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.info(
                `[FAILED]: Analytics update failed for LEI verification: client ${clientId}, service ${serviceId}`,
            );
        }

        businessServiceLogger.info(
            `Checked for existing LEI record in DB: ${existingLEI ? "Found" : "Not Found"}, `,
        );

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingLEI) {
            if (existingLEI?.status == 1) {
                businessServiceLogger.info(
                    `Returning cached LEI response for client: ${clientId}`,
                );

                const decrypted = {
                    ...existingLEI?.response,
                    CompanyName: CompanyName,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingLEI?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            } else {
                businessServiceLogger.info(
                    `Returning cached LEI response for client: ${clientId}`,
                );
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingLEI?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingLEI?.response;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            }
        }

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);
        if (!service) {
            businessServiceLogger.info(
                `[FAILED]: Active service not found for LEI category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }
        businessServiceLogger.info(
            `Active service selected for LEI verification: ${service.serviceFor}`,
        );

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
        let response = await LeiActiveServiceResponse(CompanyName, service, 0);

        businessServiceLogger.info(
            `Active service selected for LEIverification service ${service.serviceFor}: ${response?.message}`,
        );

        // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                CompanyName: encryptedLEI,
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
                CompanyName: encryptedLEI,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await lei_Verification.create(storingData);
            businessServiceLogger.info(
                `Valid LEI response stored and sent to client: ${clientId}`,
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
                    CompanyName: CompanyName,
                    // ...findingInValidResponses("LEI"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 2,
                CompanyName: encryptedLEI,
                response: {
                    CompanyName: CompanyName,
                    // ...findingInValidResponses("LEI"),
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await lei_Verification.create(storingData);
            businessServiceLogger.info(
                `Invalid LEI response received and sent to client: ${clientId}`,
            );
            return res
                .status(404)
                .json(createApiResponse(404, { CompanyName: CompanyName }, "Failed"));
        }

    } catch (error) {
        businessServiceLogger.error(
            `System error in LEI verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

// Udyog Aadhaar:
exports.dinVerification = async (req, res) => {
    const { UAMNumber, mobileNumber = "" } = req.body;
    const clientId = req.clientId;

    if (!UAMNumber) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }
    businessServiceLogger.info(`UAM NUMBER Details: ${UAMNumber}`);
    try {
        const { categoryId, serviceId } = await getCategoryIdAndServiceId('UAM', clientId);

        const isValid = handleValidation("UAM", UAMNumber, res, clientId);
        if (!isValid) return;

        businessServiceLogger.info(
            `Executing UAM verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
        );

        //1. HASH UAM NUMBER
        const indetifierHash = hashIdentifiers({
            UAMNumber: UAMNumber
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const UAMRateLimitResult = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!UAMRateLimitResult.allowed) {
            businessServiceLogger.info(`[FAILED]: Rate limit exceeded for UAM verification: client ${clientId}, service ${serviceId}`);
            return res.status(429).json({
                success: false,
                message: UAMRateLimitResult.message,
            });
        };

        const tnId = genrateUniqueServiceId();
        businessServiceLogger.info(`Generated UAM txn Id: ${tnId}`);

        // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            businessServiceLogger.info(`[FAILED]: Credit deduction failed for UAM verification: client ${clientId}, txnId ${tnId}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {},
            });
        }

        // 4. CHECK IN THE DB IS DATA PRESENT 
        const encryptedUAM = encryptData(UAMNumber);

        const existingUAM = await UAM_verifyModel.findOne({ UAMNumber: encryptedUAM })

        // 5. UPDATE TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
        );
        if (!analyticsResult.success) {
            businessServiceLogger.info(
                `[FAILED]: Analytics update failed for UAM verification: client ${clientId}, service ${serviceId}`,
            );
        }

        businessServiceLogger.info(
            `Checked for existing UAM record in DB: ${existingUAM ? "Found" : "Not Found"}, `,
        );

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingUAM) {
            if (existingUAM?.status == 1) {
                businessServiceLogger.info(
                    `Returning cached UAM response for client: ${clientId}`,
                );

                const decrypted = {
                    ...existingUAM?.response,
                    UAMNumber: UAMNumber,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingUAM?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            } else {
                businessServiceLogger.info(
                    `Returning cached UAM response for client: ${clientId}`,
                );
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingUAM?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingUAM?.response;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            }
        }

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);
        if (!service) {
            businessServiceLogger.info(
                `[FAILED]: Active service not found for UAM category ${categoryId}, service ${serviceId}`,
            );
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        }
        businessServiceLogger.info(
            `Active service selected for UAM verification: ${service.serviceFor}`,
        );

        // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
        let response = await UAMActiveServiceResponse(UAMNumber, service, 0);

        businessServiceLogger.info(
            `Active service selected for UAMverification service ${service.serviceFor}: ${response?.message}`,
        );

        // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                UAMNumber: encryptedUAM,
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
                UAMNumber: encryptedUAM,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await UAM_verifyModel.create(storingData);
            businessServiceLogger.info(
                `Valid UAM response stored and sent to client: ${clientId}`,
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
                    UAMNumber: UAMNumber,
                    // ...findingInValidResponses("UAM"),
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 2,
                UAMNumber: encryptedUAM,
                response: {
                    UAMNumber: UAMNumber,
                    // ...findingInValidResponses("UAM"),
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await UAM_verifyModel.create(storingData);
            businessServiceLogger.info(
                `Invalid UAM response received and sent to client: ${clientId}`,
            );
            return res
                .status(404)
                .json(createApiResponse(404, { UAMNumber: UAMNumber }, "Failed"));
        }

    } catch (error) {
        businessServiceLogger.error(
            `System error in UAM verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

// SHOPESTABLISHMENT VERIFICATION
exports.handleCreateShopEstablishment = async (req, res, next) => {
    const { registrationNumber, state } = req.body;
    const { clientId, environment } = req;

    // Use businessServiceLogger for consistent logging
    businessServiceLogger.info(`Shop Establishment Details ===>> registrationNumber: ${registrationNumber} --- state: ${state}`);

    if (!registrationNumber || !state) {
        businessServiceLogger.warn("Missing registrationNumber or state");
        return res.status(ERROR_CODES?.BAD_REQUEST.httpCode).json(createApiResponse(ERROR_CODES?.BAD_REQUEST.code, [], 'Invalid request parameters'));
    }

    try {
        const existingDetails = await shopestablishmentModel.findOne({
            registrationNumber: registrationNumber,
        });
        if (existingDetails) {
            businessServiceLogger.info("Shop Establishment details found in DB");
            return res.status(200).json(createApiResponse(200, existingDetails?.response?.result, 'Valid'));
        }

        // Check credits before proceeding
        const creditCheck = await CreditService.checkCredits(clientId, environment);
        if (!creditCheck.success) {
            businessServiceLogger.warn("Insufficient credits for Shop Establishment verification");
            return res.status(ERROR_CODES.INSUFFICIENT_CREDITS.httpCode).json(createApiResponse(ERROR_CODES.INSUFFICIENT_CREDITS.code, {}, creditCheck.message));
        }

        const service = await selectService("SHOP");
        businessServiceLogger.info(`----active service for Shop Verify is ----, ${service}`);

        let response = await shopActiveServiceResponse({ registrationNumber, state }, service, 0);
        businessServiceLogger.info(`Shop verify response ===> ${JSON.stringify(response)}`);

        // Deduct credits if successful
        if (response?.result) {
            await CreditService.deductCredits(clientId, environment, "SHOP", response.transId || `SHOP-${Date.now()}`);
        }

        const savedData = await shopestablishmentModel.create(response);
        return res.status(200).json(createApiResponse(200, response?.result, 'Valid'));
    } catch (error) {
        businessServiceLogger.error(`Error performing Shop verification: ${error.message}`);
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(createApiResponse(errorObj.code, {}, errorObj.message));
    }
};


