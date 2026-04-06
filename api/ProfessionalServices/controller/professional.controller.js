const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const handleValidation = require("../../../utils/lengthCheck");
const { professionalLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const charterdAccountModel = require("../model/charterdAccount.model");
const DentistModel = require("../model/Dentist.model");
const DocterModel = require("../model/Docter.model");
const InsuranceModel = require("../model/Insurance.model");
const { professionalActiveServiceResponse } = require("../services/Professionalservices");
const { generateTransactionId } = require("../../truthScreen/callTruthScreen");


exports.InsuranceVerification = async (req, res) => {
    const { PanNumber, MobileNumber } = req.body;
    const clientId = req.clientId;
    const TxnID = await generateTransactionId(12);

    if (!PanNumber) {
        return res.status(400).json(createApiResponse(400, null, ERROR_CODES?.BAD_REQUEST))
    };
    professionalLogger.info(`TxnID:${TxnID}, PAN NUMBER Details: ${PanNumber}`);
    try {
        const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('INSURANCE', TxnID, professionalLogger);

        const isValid = handleValidation('pan', PanNumber, res, TxnID, professionalLogger);
        if (!isValid) return;

        professionalLogger.info(`TxnID:${TxnID}, Executing Insurance Verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

        //1. Hash Pan Number
        const indetifierHash = hashIdentifiers({
            PanNumber
        }, professionalLogger);

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const InsuranceRateLimit = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId,
            categoryId,
            clientId,
            req,
            TxnID,
            logger: professionalLogger
        });

        if (!InsuranceRateLimit.allowed) {
            professionalLogger.info(`[FAILED]: Rate limit exceeded for Insurance verification: TxnID:${TxnID}, clientId:${clientId}, service:${serviceId}`);
            return res.status(429).json({ success: false, message: InsuranceRateLimit?.message });
        };

        professionalLogger.info(`Generated Insurance txn Id: ${TxnID}`);

        //3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            TxnID,
            req,
            professionalLogger
        );

        if (!maintainanceResponse?.result) {
            professionalLogger.info(`[FAILED]: Credit deducation failed for Insurance verification: clientId${clientId}, txnId:${TxnID}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {}
            })
        };

        //4. CHECK IN THE DB IS DATA PRESENT
        const encryptedPan = encryptData(PanNumber);

        const existingPan = await InsuranceModel.findOne({ PanNumber: encryptedPan });

        //5. UPDATED TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
            'success',
            professionalLogger
        );

        if (!analyticsResult.success) {
            professionalLogger.info(`TxnID:${TxnID}, [FAILED]: Analytics update for Insurance verification: client:${clientId}, serviceId: ${serviceId}`);
        };
        professionalLogger.info(`TxnID:${TxnID}, Checked for existing Pan Records in DB: ${existingPan ? "Found" : "Not Found"}`);

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingPan) {
            if (existingPan?.status === 1) {
                professionalLogger.info(`TxnID:${TxnID}, Returning cached Insurance response for clientId: ${clientId}`);
                const decrypted = {
                    ...existingPan?.response,
                    PanNumber
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    TxnID,
                    clientId,
                    result: existingPan?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = decrypted;
                return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
            } else {
                professionalLogger.info(`TxnID:${TxnID}, Returning cached Insurance Response for client: ${clientId}`);
                await responseModel.create({
                    serviceId,
                    categoryId,
                    TxnID,
                    clientId,
                    result: existingPan?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = existingPan?.response;
                return res.status(404).json(createApiResponse(404, dataToShow, 'InValid'));
            }
        }

        // 7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId, clientId, req, professionalLogger);
        if (!service.length) {
            professionalLogger.info(`TxnID:${TxnID}, [FAILED]: Active Service not found for Insurance, Category:${categoryId}, serviceID:${serviceId}`);
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };
        professionalLogger.info(`TxnID:${TxnID}, Active Service Selected for Insurance verfication: ${service}`);

        //8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
        let response = await professionalActiveServiceResponse(PanNumber, service, "InsuranceApiCall", 0, TxnID);

        professionalLogger.info(`TxnID:${TxnID}, Active service for Insurance verification service ${response?.service}: ${response?.message}`)

        //9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message.toUpperCase() == 'VALID') {
            const encryptedResponse = {
                ...response?.result,
                PanNumber: encryptedPan
            };
            await responseModel.create({
                serviceId,
                categoryId,
                TxnID,
                clientId,
                result: response?.result,
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            });
            const storingData = {
                status: 1,
                PanNumber: encryptedPan,
                response: encryptedResponse,
                serviceName: response?.service,
                message: response?.message,
                MobileNumber,
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            };

            await InsuranceModel.findOneAndUpdate(
                { PanNumber: encryptedPan },
                { $setOnInsert: storingData },
                { upsert: true, new: true }
            );
            professionalLogger.info(`TxnID:${TxnID}, Valid Insurance response stored and send to client: ${clientId}`)

            return res.status(200).json(createApiResponse(200, response?.result, 'Success'));
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
                TxnID,
                clientId,
                result: {
                    PanNumber
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            });
            const storingData = {
                status: 2,
                PanNumber: encryptedPan,
                response: {
                    PanNumber: PanNumber
                },
                serviceResponse: {},
                serviceName: response?.service,
                MobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString()
            };
            await InsuranceModel.findOneAndUpdate(
                { PanNumber: encryptedPan },
                { $setOnInsert: storingData },
                { upsert: true, new: true }
            );
            professionalLogger.info(`TxnID:${TxnID}, Invalid Insurance response recevied and sent to client: ${clientId}`);
            return res.status(404).json(createApiResponse(404, { PanNumber: PanNumber }, "Failed"))
        }

    } catch (error) {
        professionalLogger.error(
            `TxnID:${TxnID}, System error in Insurance verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

exports.CharteredAccountantVerification = async (req, res) => {
    const { MembershipNumber, MobileNumber } = req.body;
    const clientId = req.clientId;
    const TxnID = await generateTransactionId(12);

    if (!MembershipNumber) {
        return res.status(400).json(createApiResponse(400, null, ERROR_CODES?.BAD_REQUEST))
    };
    professionalLogger.info(`TxnID:${TxnID}, CA NUMBER Details: ${MembershipNumber}`);
    try {
        const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('CA', TxnID, professionalLogger);

        const isValid = handleValidation('CA', MembershipNumber, res, TxnID, professionalLogger);
        if (!isValid) return;

        professionalLogger.info(`TxnID:${TxnID}, Executing CA Verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

        //1. Hash MembershipNumber
        const indetifierHash = hashIdentifiers({ MembershipNumber }, professionalLogger);

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const CARateLimit = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId,
            categoryId,
            clientId,
            req,
            TxnID,
            logger: professionalLogger
        });

        if (!CARateLimit.allowed) {
            professionalLogger.info(`[FAILED]: Rate limit exceeded for CA verification: TxnID:${TxnID}, clientId:${clientId}, service:${serviceId}`);
            return res.status(429).json({ success: false, message: CARateLimit?.message });
        };

        professionalLogger.info(`Generated CA txn Id: ${TxnID}`);

        //3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            TxnID,
            req,
            professionalLogger
        );

        if (!maintainanceResponse?.result) {
            professionalLogger.info(`[FAILED]: Credit deducation failed for CA verification: clientId${clientId}, txnId:${TxnID}`);
            return res.status(500).json({
                success: false,
                message: maintainanceResponse?.message || "InValid",
                response: {}
            })
        };

        //4. CHECK IN THE DB IS DATA PRESENT
        const encryptedMembershipNumber = encryptData(MembershipNumber);

        const existingMerberNumber = await charterdAccountModel.findOne({ MembershipNumber: encryptedMembershipNumber });

        //5. UPDATED TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
            'success',
            professionalLogger
        );

        if (!analyticsResult.success) {
            professionalLogger.info(`TxnID:${TxnID}, [FAILED]: Analytics update for CA verification: client:${clientId}, serviceId: ${serviceId}`);
        };
        professionalLogger.info(`TxnID:${TxnID}, Checked for existing Mermbership number Records in DB: ${existingMerberNumber ? "Found" : "Not Found"}`);

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingMerberNumber) {
            if (existingMerberNumber?.status === 1) {
                professionalLogger.info(`TxnID:${TxnID}, Returning cached CA response for clientId: ${clientId}`);
                const decrypted = {
                    ...existingMerberNumber?.response,
                    MembershipNumber
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    TxnID,
                    clientId,
                    result: existingMerberNumber?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = decrypted;
                return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
            } else {
                professionalLogger.info(`TxnID:${TxnID}, Returning cached CA Response for client: ${clientId}`);
                await responseModel.create({
                    serviceId,
                    categoryId,
                    TxnID,
                    clientId,
                    result: existingMerberNumber?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = existingMerberNumber?.response;
                return res.status(404).json(createApiResponse(404, dataToShow, 'InValid'));
            }
        }

        // 7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId, clientId, req, professionalLogger);
        if (!service.length) {
            professionalLogger.info(`TxnID:${TxnID}, [FAILED]: Active Service not found for CA, Category:${categoryId}, serviceID:${serviceId}`);
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };
        professionalLogger.info(`TxnID:${TxnID}, Active Service Selected for CA verfication: ${service}`);

        //8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
        let response = await professionalActiveServiceResponse(MembershipNumber, service, "CAApiCall", 0, TxnID);

        professionalLogger.info(`TxnID:${TxnID}, Active service for CA verification service ${service?.service}: ${response?.message}`)

        //9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message.toUpperCase() == 'VALID') {
            const encryptedResponse = {
                ...response?.result,
                MembershipNumber: encryptedMembershipNumber
            };
            await responseModel.create({
                serviceId,
                categoryId,
                TxnID,
                clientId,
                result: response?.result,
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            });
            const storingData = {
                status: 1,
                MembershipNumber: encryptedMembershipNumber,
                response: encryptedResponse,
                serviceName: response?.service,
                message: response?.message,
                MobileNumber,
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            };

            await charterdAccountModel.findOneAndUpdate(
                { MembershipNumber: encryptedMembershipNumber },
                { $setOnInsert: storingData },
                { upsert: true, new: true }
            );
            professionalLogger.info(`TxnID:${TxnID}, Valid CA response stored and send to client: ${clientId}`)

            return res.status(200).json(createApiResponse(200, response?.result, 'Success'));
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
                TxnID,
                clientId,
                result: {
                    MembershipNumber
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            });
            const storingData = {
                status: 2,
                MembershipNumber: encryptedMembershipNumber,
                response: {
                    MembershipNumber: MembershipNumber
                },
                serviceResponse: {},
                serviceName: response?.service,
                MobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString()
            };
            await charterdAccountModel.findOneAndUpdate(
                { MembershipNumber: encryptedMembershipNumber },
                { $setOnInsert: storingData },
                { upsert: true, new: true }
            );
            professionalLogger.info(`TxnID:${TxnID}, Invalid CA response recevied and sent to client: ${clientId}`);
            return res.status(404).json(createApiResponse(404, { MembershipNumber: MembershipNumber }, "Failed"))
        }

    } catch (error) {
        professionalLogger.error(
            `TxnID:${TxnID}, System error in CA verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

exports.DocterVerification = async (req, res) => {
    const { RegistrationNumber, state, MobileNumber } = req.body;
    const clientId = req.clientId;
    const TxnID = await generateTransactionId(12);

    if (!RegistrationNumber || !state) {
        return res.status(400).json(createApiResponse(400, null, ERROR_CODES?.BAD_REQUEST))
    };
    professionalLogger.info(`TxnID:${TxnID}, Registration Number Details: ${RegistrationNumber}`);
    try {
        const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('Docter', TxnID, professionalLogger);

        const isValid = handleValidation('DocterRg', RegistrationNumber, res, TxnID, professionalLogger);
        if (!isValid) return;

        professionalLogger.info(`TxnID:${TxnID}, Executing Docter Verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

        //1. Hash RegistrationNumber
        const indetifierHash = hashIdentifiers({
            RegistrationNumber
        }, professionalLogger);

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const DocterRateLimit = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId,
            categoryId,
            clientId,
            req,
            TxnID,
            logger: professionalLogger
        });

        if (!DocterRateLimit.allowed) {
            professionalLogger.info(`[FAILED]: Rate limit exceeded for Docter verification: TxnID:${TxnID}, clientId:${clientId}, service:${serviceId}`);
            return res.status(429).json({ success: false, message: DocterRateLimit?.message });
        };

        professionalLogger.info(`Generated Docter txn Id: ${TxnID}`);

        //3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            TxnID,
            req,
            professionalLogger
        );

        if (!maintainanceResponse?.result) {
            professionalLogger.info(`[FAILED]: Credit deducation failed for Docter verification: clientId${clientId}, txnId:${TxnID}`);
            return res.status(500).json(createApiResponse(500, {}, maintainanceResponse?.message || "InValid"));
        };

        //4. CHECK IN THE DB IS DATA PRESENT
        const encryptedRgNo = encryptData(RegistrationNumber);

        const existingRgNo = await DocterModel.findOne({ RegistrationNumber: encryptedRgNo });

        //5. UPDATED TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
            'success',
            professionalLogger
        );

        if (!analyticsResult.success) {
            professionalLogger.info(`TxnID:${TxnID}, [FAILED]: Analytics update for Docter verification: client:${clientId}, serviceId: ${serviceId}`);
        };
        professionalLogger.info(`TxnID:${TxnID}, Checked for existing RegistrationNumber Records in DB: ${existingRgNo ? "Found" : "Not Found"}`);

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingRgNo) {
            if (existingRgNo?.status === 1) {
                professionalLogger.info(`TxnID:${TxnID}, Returning cached Docter response for clientId: ${clientId}`);
                const decrypted = {
                    ...existingRgNo?.response,
                    RegistrationNumber
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    TxnID,
                    clientId,
                    result: existingRgNo?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = decrypted;
                return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
            } else {
                professionalLogger.info(`TxnID:${TxnID}, Returning cached Docter Response for client: ${clientId}`);
                await responseModel.create({
                    serviceId,
                    categoryId,
                    TxnID,
                    clientId,
                    result: existingRgNo?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = existingRgNo?.response;
                return res.status(404).json(createApiResponse(404, dataToShow, 'InValid'));
            }
        }

        // 7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId, clientId, req, professionalLogger);
        if (!service.length) {
            professionalLogger.info(`TxnID:${TxnID}, [FAILED]: Active Service not found for Docter, Category:${categoryId}, serviceID:${serviceId}`);
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };
        professionalLogger.info(`TxnID:${TxnID}, Active Service Selected for Docter verfication: ${service}`);

        //8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
        let response = await professionalActiveServiceResponse({ Registration: RegistrationNumber, state: state }, service, "DocterApicall", 0, TxnID);

        professionalLogger.info(`TxnID:${TxnID}, Active service for Docter verification service ${service?.service}: ${response?.message}`)

        //9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message.toUpperCase() == 'VALID') {
            const encryptedResponse = {
                ...response?.result,
                RegistrationNumber: encryptedRgNo
            };
            await responseModel.create({
                serviceId,
                categoryId,
                TxnID,
                clientId,
                result: response?.result,
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            });
            const storingData = {
                status: 1,
                RegistrationNumber: encryptedRgNo,
                response: encryptedResponse,
                serviceName: response?.service,
                message: response?.message,
                MobileNumber,
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            };

            await DocterModel.findOneAndUpdate(
                { RegistrationNumber: encryptedRgNo },
                { $setOnInsert: storingData },
                { upsert: true, new: true }
            );
            professionalLogger.info(`TxnID:${TxnID}, Valid Docter response stored and send to client: ${clientId}`)

            return res.status(200).json(createApiResponse(200, response?.result, 'Success'));
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
                TxnID,
                clientId,
                result: {
                    RegistrationNumber
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            });
            const storingData = {
                status: 2,
                RegistrationNumber: encryptedRgNo,
                response: {
                    RegistrationNumber: RegistrationNumber
                },
                serviceResponse: {},
                serviceName: response?.service,
                MobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString()
            };
            await DocterModel.findOneAndUpdate(
                { RegistrationNumber: encryptedRgNo },
                { $setOnInsert: storingData },
                { upsert: true, new: true }
            );
            professionalLogger.info(`TxnID:${TxnID}, Invalid Docter response recevied and sent to client: ${clientId}`);
            return res.status(404).json(createApiResponse(404, { RegistrationNumber: RegistrationNumber }, "Failed"))
        }

    } catch (error) {
        professionalLogger.error(
            `TxnID:${TxnID}, System error in Docter verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

exports.DentistVerification = async (req, res) => {
    const { RegistrationNumber, state, MobileNumber } = req.body;
    const clientId = req.clientId;
    const TxnID = await generateTransactionId(12);

    if (!RegistrationNumber || !state) {
        return res.status(400).json(createApiResponse(400, null, ERROR_CODES?.BAD_REQUEST))
    };
    professionalLogger.info(`TxnID:${TxnID}, Registration Number Details: ${RegistrationNumber}`);
    try {
        const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('Dentist', TxnID, professionalLogger);

        const isValid = handleValidation('DocterRg', RegistrationNumber, res, TxnID, professionalLogger);
        if (!isValid) return;

        professionalLogger.info(`TxnID:${TxnID}, Executing Dentist Verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

        //1. Hash RegistrationNumber
        const indetifierHash = hashIdentifiers({
            RegistrationNumber
        }, professionalLogger);

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const dentistRateLimit = await checkingRateLimit({
            identifiers: { indetifierHash },
            serviceId,
            categoryId,
            clientId,
            req,
            TxnID,
            logger: professionalLogger
        });

        if (!dentistRateLimit.allowed) {
            professionalLogger.info(`[FAILED]: Rate limit exceeded for Dentist verification: TxnID:${TxnID}, clientId:${clientId}, service:${serviceId}`);
            return res.status(429).json({ success: false, message: dentistRateLimit?.message });
        };

        professionalLogger.info(`Generated Dentist txn Id: ${TxnID}`);

        //3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            TxnID,
            req,
            professionalLogger
        );

        if (!maintainanceResponse?.result) {
            professionalLogger.info(`[FAILED]: Credit deducation failed for Dentist verification: clientId${clientId}, txnId:${TxnID}`);
            return res.status(500).json(createApiResponse(500, {}, maintainanceResponse?.message || "InValid"));
        };

        //4. CHECK IN THE DB IS DATA PRESENT
        const encryptedRgNo = encryptData(RegistrationNumber);

        const existingRgNo = await DentistModel.findOne({ RegistrationNumber: encryptedRgNo });

        //5. UPDATED TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId,
            'success',
            professionalLogger
        );

        if (!analyticsResult.success) {
            professionalLogger.info(`TxnID:${TxnID}, [FAILED]: Analytics update for Dentist verification: client:${clientId}, serviceId: ${serviceId}`);
        };
        professionalLogger.info(`TxnID:${TxnID}, Checked for existing RegistrationNumber Records in DB: ${existingRgNo ? "Found" : "Not Found"}`);

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingRgNo) {
            if (existingRgNo?.status === 1) {
                professionalLogger.info(`TxnID:${TxnID}, Returning cached Dentist response for clientId: ${clientId}`);
                const decrypted = {
                    ...existingRgNo?.response,
                    RegistrationNumber
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    TxnID,
                    clientId,
                    result: existingRgNo?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = decrypted;
                return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
            } else {
                professionalLogger.info(`TxnID:${TxnID}, Returning cached Dentist Response for client: ${clientId}`);
                await responseModel.create({
                    serviceId,
                    categoryId,
                    TxnID,
                    clientId,
                    result: existingRgNo?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = existingRgNo?.response;
                return res.status(404).json(createApiResponse(404, dataToShow, 'InValid'));
            }
        }

        // 7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
        const service = await selectService(categoryId, serviceId, clientId, req, professionalLogger);
        if (!service.length) {
            professionalLogger.info(`TxnID:${TxnID}, [FAILED]: Active Service not found for Dentist, Category:${categoryId}, serviceID:${serviceId}`);
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };
        professionalLogger.info(`TxnID:${TxnID}, Active Service Selected for Dentist verfication: ${service}`);

        //8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
        let response = await professionalActiveServiceResponse({ Registration: RegistrationNumber, state: state }, service, "DentistApicall", 0, TxnID);

        professionalLogger.info(`TxnID:${TxnID}, Active service for Dentist verification service ${service?.service}: ${response?.message}`)

        //9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message.toUpperCase() == 'VALID') {
            const encryptedResponse = {
                ...response?.result,
                RegistrationNumber: encryptedRgNo
            };
            await responseModel.create({
                serviceId,
                categoryId,
                TxnID,
                clientId,
                result: response?.result,
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            });
            const storingData = {
                status: 1,
                RegistrationNumber: encryptedRgNo,
                response: encryptedResponse,
                serviceName: response?.service,
                message: response?.message,
                MobileNumber,
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            };

            await DentistModel.findOneAndUpdate(
                { RegistrationNumber: encryptedRgNo },
                { $setOnInsert: storingData },
                { upsert: true, new: true }
            );
            professionalLogger.info(`TxnID:${TxnID}, Valid Dentist response stored and send to client: ${clientId}`)

            return res.status(200).json(createApiResponse(200, response?.result, 'Success'));
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
                TxnID,
                clientId,
                result: {
                    RegistrationNumber
                },
                createdTime: new Date().toLocaleTimeString(),
                createdDate: new Date().toLocaleDateString()
            });
            const storingData = {
                status: 2,
                RegistrationNumber: encryptedRgNo,
                response: {
                    RegistrationNumber: RegistrationNumber
                },
                serviceResponse: {},
                serviceName: response?.service,
                MobileNumber,
                message: response?.message,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString()
            };
            await DentistModel.findOneAndUpdate(
                { RegistrationNumber: encryptedRgNo },
                { $setOnInsert: storingData },
                { upsert: true, new: true }
            );
            professionalLogger.info(`TxnID:${TxnID}, Invalid Dentist response recevied and sent to client: ${clientId}`);
            return res.status(404).json(createApiResponse(404, { RegistrationNumber: RegistrationNumber }, "Failed"))
        }

    } catch (error) {
        professionalLogger.error(
            `TxnID:${TxnID}, System error in Dentist verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

// Not Integrated
exports.eSignAadhaarBased = async (req,res)=>{
    const {} = req.body;
    try{

    }catch(error){

    }
};
