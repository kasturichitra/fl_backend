const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const { ERROR_CODES } = require("../../../utils/errorCodes");
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


exports.InsuranceVerification = async (req, res) => {
    const { PanNumber, MobileNumber } = req.body;
    const clientId = req.clientId;

    if (!PanNumber) {
        return res.status(400).json(createApiResponse(400, null, ERROR_CODES?.BAD_REQUEST))
    };
    professionalLogger.info(`PAN NUMBER Details: ${PanNumber}`);
    try {
        const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('INSURANCE', clientId);

        const isValid = handleValidation('pan', PanNumber, res, clientId);
        if (!isValid) return;

        professionalLogger.info(`Executing Insurance Verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

        //1. Hash Pan Number
        const indetifierHash = hashIdentifiers({
            PanNumber
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const InsuranceRateLimit = await checkingRateLimit({
            indetifierHash: { indetifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!InsuranceRateLimit.allowed) {
            professionalLogger.info(`[FAILED]: Rate limit exceeded for Insurance verification: clientId:${clientId}, service:${serviceId}`);
            return res.status(429).json({ success: false, message: InsuranceRateLimit?.message });
        };

        const tnId = genrateUniqueServiceId();
        professionalLogger.info(`Generated Insurance txn Id: ${tnId}`);

        //3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            professionalLogger.info(`[FAILED]: Credit deducation failed for Insurance verification: clientId${clientId}, txnId:${tnId}`);
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
            categoryId
        );

        if (!analyticsResult.success) {
            professionalLogger.info(`[FAILED]: Analytics update for Insurance verification: client:${clientId}, serviceId: ${serviceId}`);
        };
        professionalLogger.info(`Checked for existing Pan Records in DB: ${existingPan}`);

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingPan) {
            if (existingPan?.status === 1) {
                professionalLogger.info(`
                    Returning cached Insurance response for clientId: ${clientId}
                `);
                const decrypted = {
                    ...existingPan?.response,
                    PanNumber
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingPan?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = decrypted;
                return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
            } else {
                professionalLogger.info(`
                    Returning cached Insurance Response for client: ${clientId}
                    `);
                await responseModel.create({
                    serviceId,
                    categoryId,
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
        const service = await selectService(categoryId, serviceId);
        if (!service.length) {
            professionalLogger.info(`[FAILED]: Active Service not found for Insurance, Category:${categoryId}, serviceID:${serviceId}`);
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };
        professionalLogger.info(`Active Service Selected for Insurance verfication: ${service}`);

        //8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
        let response = await professionalActiveServiceResponse(PanNumber, service, "InsuranceApiCall", 0);

        professionalLogger.info(`Active service for Insurance verification service ${service?.service}: ${response?.message}`)

        //9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message.toUpperCase() == 'VALID') {
            const encryptedResponse = {
                ...response?.result,
                PanNumber: encryptedPan
            };
            await responseModel.create({
                serviceId,
                categoryId,
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

            await InsuranceModel.create(storingData);
            professionalLogger.info(`Valid Insurance response stored and send to client: ${clientId}`)

            return res.status(200).json(createApiResponse(200, response?.result, 'Success'));
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
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
            await InsuranceModel.create(storingData);
            professionalLogger.info(`
                    Invalid Insurance response recevied and sent to client: ${clientId}
                `);
            return res.status(404).json(createApiResponse(404, { PanNumber: PanNumber }, "Failed"))
        }

    } catch (error) {
        professionalLogger.error(
            `System error in DIN verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
}

exports.CharteredAccountantVerification = async (req, res) => {
    const { MembershipNumber, MobileNumber } = req.body;
    const clientId = req.clientId;

    if (!MembershipNumber) {
        return res.status(400).json(createApiResponse(400, null, ERROR_CODES?.BAD_REQUEST))
    };
    professionalLogger.info(`CA NUMBER Details: ${MembershipNumber}`);
    try {
        const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('CA', clientId);

        const isValid = handleValidation('CA', MembershipNumber, res, clientId);
        if (!isValid) return;

        professionalLogger.info(`Executing CA Verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

        //1. Hash Pan Number
        const indetifierHash = hashIdentifiers({ MembershipNumber });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const CARateLimit = await checkingRateLimit({
            indetifierHash: { indetifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!CARateLimit.allowed) {
            professionalLogger.info(`[FAILED]: Rate limit exceeded for CA verification: clientId:${clientId}, service:${serviceId}`);
            return res.status(429).json({ success: false, message: CARateLimit?.message });
        };

        const tnId = genrateUniqueServiceId();
        professionalLogger.info(`Generated Insurance txn Id: ${tnId}`);

        //3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            professionalLogger.info(`[FAILED]: Credit deducation failed for CA verification: clientId${clientId}, txnId:${tnId}`);
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
            categoryId
        );

        if (!analyticsResult.success) {
            professionalLogger.info(`[FAILED]: Analytics update for CA verification: client:${clientId}, serviceId: ${serviceId}`);
        };
        professionalLogger.info(`Checked for existing Mermbership number Records in DB: ${existingMerberNumber}`);

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingMerberNumber) {
            if (existingMerberNumber?.status === 1) {
                professionalLogger.info(`
                    Returning cached CA response for clientId: ${clientId}
                `);
                const decrypted = {
                    ...existingMerberNumber?.response,
                    MembershipNumber
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingMerberNumber?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = decrypted;
                return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
            } else {
                professionalLogger.info(`
                    Returning cached CA Response for client: ${clientId}
                    `);
                await responseModel.create({
                    serviceId,
                    categoryId,
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
        const service = await selectService(categoryId, serviceId);
        if (!service.length) {
            professionalLogger.info(`[FAILED]: Active Service not found for CA, Category:${categoryId}, serviceID:${serviceId}`);
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };
        professionalLogger.info(`Active Service Selected for CA verfication: ${service}`);

        //8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
        let response = await professionalActiveServiceResponse(MembershipNumber, service, "CAApiCall", 0);

        professionalLogger.info(`Active service for CA verification service ${service?.service}: ${response?.message}`)

        //9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message.toUpperCase() == 'VALID') {
            const encryptedResponse = {
                ...response?.result,
                MembershipNumber: encryptedMembershipNumber
            };
            await responseModel.create({
                serviceId,
                categoryId,
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

            await charterdAccountModel.create(storingData);
            professionalLogger.info(`Valid CA response stored and send to client: ${clientId}`)

            return res.status(200).json(createApiResponse(200, response?.result, 'Success'));
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
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
            await charterdAccountModel.create(storingData);
            professionalLogger.info(`
                    Invalid CA response recevied and sent to client: ${clientId}
                `);
            return res.status(404).json(createApiResponse(404, { MembershipNumber: MembershipNumber }, "Failed"))
        }

    } catch (error) {
        professionalLogger.error(
            `System error in DIN verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

exports.DocterVerification = async (req, res) => {
    const { RegistrationNumber, state, MobileNumber } = req.body;
    const clientId = req.clientId;

    if (!RegistrationNumber || !state) {
        return res.status(400).json(createApiResponse(400, null, ERROR_CODES?.BAD_REQUEST))
    };
    professionalLogger.info(`Registration Number Details: ${RegistrationNumber}`);
    try {
        const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('Docter', clientId);

        const isValid = handleValidation('DocterRg', RegistrationNumber, res, clientId);
        if (!isValid) return;

        professionalLogger.info(`Executing Docter Verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

        //1. Hash Pan Number
        const indetifierHash = hashIdentifiers({
            RegistrationNumber
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const DocterRateLimit = await checkingRateLimit({
            indetifierHash: { indetifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!DocterRateLimit.allowed) {
            professionalLogger.info(`[FAILED]: Rate limit exceeded for Docter verification: clientId:${clientId}, service:${serviceId}`);
            return res.status(429).json({ success: false, message: DocterRateLimit?.message });
        };

        const tnId = genrateUniqueServiceId();
        professionalLogger.info(`Generated Docter txn Id: ${tnId}`);

        //3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            professionalLogger.info(`[FAILED]: Credit deducation failed for Docter verification: clientId${clientId}, txnId:${tnId}`);
            return res.status(500).json(createApiResponse(500, {}, maintainanceResponse?.message || "InValid"));
        };

        //4. CHECK IN THE DB IS DATA PRESENT
        const encryptedRgNo = encryptData(RegistrationNumber);

        const existingRgNo = await DocterModel.findOne({ RegistrationNumber: encryptedRgNo });

        //5. UPDATED TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId
        );

        if (!analyticsResult.success) {
            professionalLogger.info(`[FAILED]: Analytics update for Docter verification: client:${clientId}, serviceId: ${serviceId}`);
        };
        professionalLogger.info(`Checked for existing RegistrationNumber Records in DB: ${existingRgNo}`);

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingRgNo) {
            if (existingRgNo?.status === 1) {
                professionalLogger.info(`
                    Returning cached Docter response for clientId: ${clientId}
                `);
                const decrypted = {
                    ...existingRgNo?.response,
                    RegistrationNumber
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingRgNo?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = decrypted;
                return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
            } else {
                professionalLogger.info(`
                    Returning cached Docter Response for client: ${clientId}
                    `);
                await responseModel.create({
                    serviceId,
                    categoryId,
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
        const service = await selectService(categoryId, serviceId);
        if (!service.length) {
            professionalLogger.info(`[FAILED]: Active Service not found for Docter, Category:${categoryId}, serviceID:${serviceId}`);
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };
        professionalLogger.info(`Active Service Selected for Docter verfication: ${service}`);

        //8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
        let response = await professionalActiveServiceResponse({ Registration: RegistrationNumber, state: state }, service, "DocterApicall", 0);

        professionalLogger.info(`Active service for Docter verification service ${service?.service}: ${response?.message}`)

        //9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message.toUpperCase() == 'VALID') {
            const encryptedResponse = {
                ...response?.result,
                RegistrationNumber: encryptedRgNo
            };
            await responseModel.create({
                serviceId,
                categoryId,
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

            await DocterModel.create(storingData);
            professionalLogger.info(`Valid Docter response stored and send to client: ${clientId}`)

            return res.status(200).json(createApiResponse(200, response?.result, 'Success'));
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
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
            await DocterModel.create(storingData);
            professionalLogger.info(`
                    Invalid Docter response recevied and sent to client: ${clientId}
                `);
            return res.status(404).json(createApiResponse(404, { RegistrationNumber: RegistrationNumber }, "Failed"))
        }

    } catch (error) {
        professionalLogger.error(
            `System error in Docter verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

exports.DentistVerification = async (req, res) => {
    const { RegistrationNumber, state, MobileNumber } = req.body;
    const clientId = req.clientId;

    if (!RegistrationNumber || !state) {
        return res.status(400).json(createApiResponse(400, null, ERROR_CODES?.BAD_REQUEST))
    };
    professionalLogger.info(`Registration Number Details: ${RegistrationNumber}`);
    try {
        const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('Dentist', clientId);

        const isValid = handleValidation('DocterRg', RegistrationNumber, res, clientId);
        if (!isValid) return;

        professionalLogger.info(`Executing Dentist Verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

        //1. Hash Pan Number
        const indetifierHash = hashIdentifiers({
            RegistrationNumber
        });

        //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
        const dentistRateLimit = await checkingRateLimit({
            indetifierHash: { indetifierHash },
            serviceId,
            categoryId,
            clientId
        });

        if (!dentistRateLimit.allowed) {
            professionalLogger.info(`[FAILED]: Rate limit exceeded for Dentist verification: clientId:${clientId}, service:${serviceId}`);
            return res.status(429).json({ success: false, message: dentistRateLimit?.message });
        };

        const tnId = genrateUniqueServiceId();
        professionalLogger.info(`Generated Dentist txn Id: ${tnId}`);

        //3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
        const maintainanceResponse = await deductCredits(
            clientId,
            serviceId,
            categoryId,
            tnId,
            req.environment
        );

        if (!maintainanceResponse?.result) {
            professionalLogger.info(`[FAILED]: Credit deducation failed for Dentist verification: clientId${clientId}, txnId:${tnId}`);
            return res.status(500).json(createApiResponse(500, {}, maintainanceResponse?.message || "InValid"));
        };

        //4. CHECK IN THE DB IS DATA PRESENT
        const encryptedRgNo = encryptData(RegistrationNumber);

        const existingRgNo = await DentistModel.findOne({ RegistrationNumber: encryptedRgNo });

        //5. UPDATED TO THE ANALYTICS COLLECTION
        const analyticsResult = await AnalyticsDataUpdate(
            clientId,
            serviceId,
            categoryId
        );

        if (!analyticsResult.success) {
            professionalLogger.info(`[FAILED]: Analytics update for Dentist verification: client:${clientId}, serviceId: ${serviceId}`);
        };
        professionalLogger.info(`Checked for existing RegistrationNumber Records in DB: ${existingRgNo}`);

        // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
        if (existingRgNo) {
            if (existingRgNo?.status === 1) {
                professionalLogger.info(`
                    Returning cached Dentist response for clientId: ${clientId}
                `);
                const decrypted = {
                    ...existingRgNo?.response,
                    RegistrationNumber
                };
                await responseModel.create({
                    serviceId,
                    categoryId,
                    clientId,
                    result: existingRgNo?.response,
                    createdTime: new Date().toLocaleTimeString(),
                    createdDate: new Date().toLocaleDateString()
                });
                const dataToShow = decrypted;
                return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
            } else {
                professionalLogger.info(`
                    Returning cached Dentist Response for client: ${clientId}
                    `);
                await responseModel.create({
                    serviceId,
                    categoryId,
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
        const service = await selectService(categoryId, serviceId);
        if (!service.length) {
            professionalLogger.info(`[FAILED]: Active Service not found for Dentist, Category:${categoryId}, serviceID:${serviceId}`);
            return res.status(404).json(ERROR_CODES?.NOT_FOUND);
        };
        professionalLogger.info(`Active Service Selected for Dentist verfication: ${service}`);

        //8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
        let response = await professionalActiveServiceResponse({ Registration: RegistrationNumber, state: state }, service, "DentistApicall", 0);

        professionalLogger.info(`Active service for Dentist verification service ${service?.service}: ${response?.message}`)

        //9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
        if (response?.message.toUpperCase() == 'VALID') {
            const encryptedResponse = {
                ...response?.result,
                RegistrationNumber: encryptedRgNo
            };
            await responseModel.create({
                serviceId,
                categoryId,
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

            await DentistModel.create(storingData);
            professionalLogger.info(`Valid Dentist response stored and send to client: ${clientId}`)

            return res.status(200).json(createApiResponse(200, response?.result, 'Success'));
        } else {
            await responseModel.create({
                serviceId,
                categoryId,
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
            await DentistModel.create(storingData);
            professionalLogger.info(`
                    Invalid Dentist response recevied and sent to client: ${clientId}
                `);
            return res.status(404).json(createApiResponse(404, { RegistrationNumber: RegistrationNumber }, "Failed"))
        }

    } catch (error) {
        professionalLogger.error(
            `System error in Dentist verification for client ${clientId}: ${error.message}`,
            error
        );
        const errorObj = mapError(error);
        return res.status(errorObj.httpCode).json(errorObj);
    }
};

exports.eSignAadhaarBased = async (req,res)=>{
    const {} = req.body;
    try{

    }catch(error){

    }
}
