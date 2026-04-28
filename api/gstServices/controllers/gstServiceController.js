const express = require("express");
const { gstServiceLogger } = require("../../Logger/logger");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const handleValidation = require("../../../utils/lengthCheck");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { deductCredits } = require("../../../services/CreditService");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const { selectService } = require("../../service/serviceSelector");
const gstSolutionModel = require("../model/gstSolutionModel");
const { gstActiveServiceResponse } = require("../services/gstActiveServiceResponse");
const AdvanceGstModel = require("../model/AdvanceGstModel");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");

exports.ComprehensiveGSTSolution = async (req, res) => {
    const { gstNo, year, mobileNumber } = req.body;
    const clientId = req.clientId;

    if (!gstNo || !year) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }
    gstServiceLogger.info(`GST NUMBER DETAILS: ${gstNo}`);
    try {
        const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('gstNo', clientId);

        const isValid = handleValidation('gstin', gstNo, res, clientId);
        if (!isValid) return;

        gstServiceLogger.info(`Executing Comprehensive GST solution for client: ${clientId}, service:${serviceId}, category: ${categoryId}`)

        // 1.HASH GST NUMBER
        const indetifierHash = hashIdentifiers({
            gstNo
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const gstNoRateLimit = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!gstNoRateLimit?.allowed) {
            gstServiceLogger.info(`[FAILED]: Rate lImit exceeded for gstNo verification: clientId${clientId}, service ${serviceId}`);
            return res.status(429).json({
                success: false,
                message: gstNoRateLimit?.message
            })
        };

        const tnId = genrateUniqueServiceId();
        gstServiceLogger.info(`Generated gstno Txn ID: ${tnId} `);

        //3.DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        )

        if (!maintainanceResponse?.result) {
            gstServiceLogger.info(`[FAILED]: Credit deduction failed for gstno Verification: client ${clientId}, txnId: ${tnId}`);
            return res.status(500).json({ success: false, message: maintainanceResponse?.message || "InValid", response: {} });
        };

        //4. CHECK IN THE DB IS DATA PRESENT 
        const encryptedgstNo = encryptData(gstNo);

        const existingGstNo = await gstSolutionModel.findOne({ gstNo });

        //5. UPDATE TO THE aNALYTICS COLLECION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,"success",TxnID,gstServiceLogger
        );
        if (!analyticsResult?.success) {
            gstServiceLogger.info(`[FAILED]: Analytics update failed for gstNo: verification: client${clientId} service: ${serviceId}`)
        };
        gstServiceLogger.info(`Checked for existing gstNo record in DB: ${existingGstNo ? 'Found' : 'Not Found'}`);

        //6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingGstNo) {
            if (existingGstNo?.status == 1) {
                gstServiceLogger.info(
                    `Returning cached gstNo response for client: ${clientId}`,
                );

                const decrypted = {
                    ...existingGstNo?.response,
                    gstNo: gstNo,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingGstNo?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            } else {
                gstServiceLogger.info(`Returning cached gstNo response for client: ${clientId}`);
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingGstNo?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingGstNo?.response;
                return res
                    .status(404)
                    .json(createApiResponse(404, dataToShow, "Invalid"));
            }
        }

        //7. IF NOT DATA FOUND THENCAL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId);
        if (!service.length) {
            gstServiceLogger.info(`[FAILED]: Active service not found for gstNo Category${categoryId},service${serviceId}`)
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };

        gstServiceLogger.info(`Active service Selected for gstNo verification: ${service}`)

        //8. CALL TO SERVICE PROFVIDERS AND GET RESPONSE
        let response = await gstActiveServiceResponse({ gstNo, year }, service, "ComprehensiveGstApiCall", 0);

        gstServiceLogger.info(
            `Active service selected for gstNo verification service ${response.service}: ${response?.message}`,
        );

        // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message?.toUpperCase() == "VALID") {
            const encryptedResponse = {
                ...response?.result,
                gstNo: encryptedgstNo,
                year
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
                gstNo: encryptedgstNo,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.service,
                message: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await gstSolutionModel.create(storingData);
            gstServiceLogger.info(`Valid gstNo response stored and sent to client: ${clientId}`);
            return res
                .status(200)
                .json(createApiResponse(200, response?.result, "Success"));
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
                clientId,
                result: {
                    gstNo: gstNo,
                    year
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString(),
            });
            const storingData = {
                status: 2,
                gstNo: encryptedgstNo,
                year,
                response: {
                    gstNo: gstNo,
                    year
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
            };

            await gstSolutionModel.create(storingData);
            gstServiceLogger.info(`Invalid gstNo response received and sent to client: ${clientId}`);
            return res
                .status(404)
                .json(createApiResponse(404, { gstNo: gstNo }, "Failed"));
        }

    } catch (error) {
        gstServiceLogger.error(
            `System error in gstNo verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
}

exports.GstAdvance = async (req, res) => {
    const { GstNo, mobileNumber } = req.body;
    const clientId = req.clientId;
    const TxnID = genrateUniqueServiceId();//TxnID

    if (!GstNo) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    };
    gstServiceLogger.info(`GstAdvance Details: ${GstNo}`)

    try {
        const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('gstAdvance', TxnID, gstServiceLogger);

        const isValid = handleValidation('gstin', GstNo, res, TxnID, gstServiceLogger);
        if (!isValid) return;

        gstServiceLogger.info(`Executing GstAdvance solution for client: ${clientId}, service:${serviceId}, category:${categoryId}`);

        //1.HASH ADVANCE GST NUMBER
        const indetifierHash = hashIdentifiers({
            GstNo
        },gstServiceLogger);

        //2.CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const RateLimit = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId, categoryId, clientId,req,TxnID,logger:gstServiceLogger
        });

        if (!RateLimit?.allowed) {
            gstServiceLogger.info(`[FAILED]:  rate limit exceeded for advancegstNo Verification: clientId:${clientId}, serviceId:${serviceId}`)
            return res.status(429).json({
                success: false,
                message: RateLimit?.message
            })
        }

        gstServiceLogger.info(`Generated GstNo Txn Id: ${TxnID}`);

        //3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            TxnID,
            req,
            gstServiceLogger
        );

        if (!maintainanceResponse?.result) {
            gstServiceLogger.info(`[FAILED]: credit deduction for GstNo Verification: clientID:${clientId}, tnId:${TxnID}`);
            return res.status(500)?.json({ success: false, message: maintainanceResponse?.message || 'InValid', response: {} })
        }

        //4. CHECK IN THE DB IS DATA PRESENT
        const encryptedgstNo = encryptData(GstNo);
        const existingGstNo = await AdvanceGstModel.findOne({ GstNo: encryptedgstNo });

        //5.UPDATE TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,'success',
            TxnID, gstServiceLogger
        );
        if (!analyticsResult?.success) {
            gstServiceLogger.info(`[FAILED]: Analytics update failed for Advance GSTNo Verification, client ${clientId}, serviceId: ${serviceId}`);
        };
        gstServiceLogger.info(`checked for existing Advance GstNo record in DB: ${existingGstNo ? 'Found' : 'Not Found'}`);

        //6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingGstNo) {
            if (existingGstNo?.status == 1) {
                gstServiceLogger.info(`Returning cached Advance GST response for client: ${clientId}`);

                const decrypted = {
                    ...existingGstNo?.response,
                    GstNo,
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    TxnID,
                    result: existingGstNo?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = decrypted;
                return res
                    .status(200)
                    .json(createApiResponse(200, dataToShow, "Valid"));
            } else {
                gstServiceLogger.info(
                    `Returning cached Advance GST response for client: ${clientId}`,
                );
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    TxnID,
                    result: existingGstNo?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString(),
                });
                const dataToShow = existingGstNo?.response;
                return res
                    .status(404)
                    .json(createApiResponse(404, dataToShow, "Invalid"));
            }
        }

        //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId, TxnID, req, gstServiceLogger);
        if (!service.length) {
            gstServiceLogger.info(`[FAILED]: Active SErvice not found for advance gst categoryId ${categoryId}, service ${serviceId}`)
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };

        gstServiceLogger.info(`Active Service selected for GstNo verification: ${service}`);

        //8. CALL TO SERVICE PROFVIDERS AND GET RESPONSE
        let response = await gstActiveServiceResponse(GstNo, service, 'GstAdvanceApiCall', 0,clientId);

        gstServiceLogger.info(`Active Service Selected for GstNo verification service: ${response?.service}: ${response?.message}`)

        //9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message?.toUpperCase() === 'VALID') {
            const encryptedResponse = {
                ...response?.result,
                GstNo: existingGstNo,
            };
            await responseModel.create({
                serviceId, categoryId, clientId,TxnID,
                result: response?.result,
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            });
            const storingData = {
                status: 1,
                GstNo: existingGstNo,
                response: encryptedResponse,
                serviceResponse: response?.responseOfService,
                serviceName: response?.message,
                mobileNumber,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString()
            };

            await AdvanceGstModel.create(storingData);
            gstServiceLogger.info(`Valid GstNo response Stored and send to client: ${clientId}`);
            return res.status(200).json(createApiResponse(200, response?.result, 'Success'))
        } else {
            await responseModel.create({
                serviceId, categoryId, clientId,TxnID,
                result: { GstNo: GstNo },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            });

            const storingData = {
                status: 2, GstNo: existingGstNo,
                response: {
                    GstNo: GstNo
                },
                serviceResponse: {},
                serviceName: response?.service,
                mobileNumber,
                message: response?.message,
                createDate: new Date().toLocaleDateString(),
                createTime: new Date().toLocaleTimeString()
            };

            await AdvanceGstModel.create(storingData);
            gstServiceLogger.info(`Invalid GstNo response received and send to client; ${clientId}`);
            return res.status(404).json(createApiResponse(404, { GstNo: GstNo }, 'Failed'));
        }

    } catch (error) {
        gstServiceLogger.error(
            `System error in Advance GST verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
}

