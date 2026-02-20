const accountdataModel = require("../models/accountdata.model");
require("dotenv").config();
const { accountLogger } = require("../../Logger/logger");
const {
  encryptData,
  decryptData,
} = require("../../../utlis/EncryptAndDecrypt");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES, mapError } = require("../../../utlis/errorCodes");
const handleValidation = require("../../../utlis/lengthCheck");
const {
  accountPennyDropSerciveResponse,
  accountPennyLessSerciveResponse,
} = require("../../GlobalApiserviceResponse/accountPennyDropSerciveResponse");
const { createApiResponse } = require("../../../utlis/ApiResponseHandler");
const creditsToBeDebited = require("../../../utlis/creditsMaintainance");
const { hashIdentifiers } = require("../../../utlis/hashIdentifier");
const chargesToBeDebited = require("../../../utlis/chargesMaintainance");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");

exports.verifyPennyDropBankAccount = async (req, res, next) => {
  const {
    account_no,
    ifsc,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
  } = req.body;
  console.log("account_no, ifsc===>", account_no, ifsc);
  accountLogger.info(
    `Account Details ===>> Acc_No: ${account_no} Ifsc: ${ifsc}`,
  );
  const capitalIfsc = ifsc?.toUpperCase();

  const isAccountValid = handleValidation("accountNumber", account_no, res);
  if (!isAccountValid) return;

  const isIfscValid = handleValidation("ifsc", capitalIfsc, res);
  if (!isIfscValid) return;

  console.log("All inputs are valid, continue processing...");

  const identifierHash = hashIdentifiers({
    accNo: account_no,
    ifscCode: capitalIfsc,
  });

  const accountPennyDropRateLimitResult = await checkingRateLimit({
    identifiers: { identifierHash },
    serviceId,
    categoryId,
    clientId: req.clientId,
  });

  if (!accountPennyDropRateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      message: accountPennyDropRateLimitResult.message,
    });
  }

  const tnId = genrateUniqueServiceId();
  accountLogger.info(`account penny drop txn Id ===>> ${tnId}`);
  let maintainanceResponse;
  if (req.environment?.toLowercase() == "test") {
    maintainanceResponse = await creditsToBeDebited(
      req.clientId,
      serviceId,
      categoryId,
      tnId,
    );
  } else {
    maintainanceResponse = await chargesToBeDebited(
      req.clientId,
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

  const encryptedAccountNumber = encryptData(account_no);
  console.log("encryptedAccountNumber ====>>", encryptedAccountNumber);
  accountLogger.info(
    `encryptedAccountNumber in pennyDrop Account verify ===>> ${encryptedAccountNumber}`,
  );
  const existingAccountDetails = await accountdataModel.findOne({
    accountNo: encryptedAccountNumber,
    accountIFSCCode: capitalIfsc,
  });

  if (existingAccountDetails) {
    accountLogger.info(
      `ExistingAccountNumber in pennyDrop Account verify ===>> ${existingAccountDetails}`,
    );
    if (existingAccountDetails?.accountHolderName) {
      const decryptedAccountNumber = decryptData(
        existingAccountDetails?.accountNo,
      );
      const responseToSend = {
        ...existingAccountDetails?.responseData,
        account_no: decryptedAccountNumber,
      };
      return res
        .status(200)
        .json(createApiResponse(200, responseToSend, "Valid"));
    } else {
      return res.status(200).json(createApiResponse(200, {}, "InValid"));
    }
  }
  const service = await selectService(categoryId, serviceId);

  console.log(
    "----active service for Account penny drop Verify is ----",
    service,
  );
  accountLogger.info(
    `----active service for Account penny drop Verify is ----, ${service}`,
  );

  try {
    const response = await accountPennyDropSerciveResponse(
      { account_no, ifsc },
      service,
      0,
    );

    console.log(
      "response from active service for account verify ===>>",
      response,
    );
    accountLogger.info(
      `response from active service for account verify ===>> ${JSON.stringify(
        response,
      )}`,
    );
    if (response?.message?.toLowerCase() == "valid") {
      const modifiedResponse = {
        ...response?.result,
        account_no: encryptedAccountNumber,
      };
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: capitalIfsc,
        status: 1,
        accountHolderName: response?.result?.name,
        serviceResponse: response?.responseOfService,
        responseData: modifiedResponse,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: capitalIfsc,
        accountHolderName: "",
        status: 2,
        serviceResponse: ERROR_CODES?.NOT_FOUND,
        responseData: ERROR_CODES?.NOT_FOUND,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);
      return res.status(200).json(createApiResponse(200, {}, "InValid"));
    }
  } catch (error) {
    console.error("Error verifying bank account verifyBankAccount:", error);
    const errorObj = mapError(error);
    return res
      .status(errorObj.httpCode)
      .json(createApiResponse(500, {}, "Server Error"));
  }
};

exports.verifyPennyLessBankAccount = async (req, res, next) => {
  const {
    account_no,
    ifsc,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = req.body;
  const data = req.body;
  console.log("account_no, ifsc===>", account_no, ifsc);
  accountLogger.info(
    `Account Details ===>> Acc_No: ${account_no} Ifsc: ${ifsc}`,
  );

  const storingClient = req.clientId || clientId;

  const isAccountValid = handleValidation("accountNumber", account_no, res);
  if (!isAccountValid) return;

  const isIfscValid = handleValidation("ifsc", ifsc, res);
  if (!isIfscValid) return;

  console.log("All inputs are valid, continue processing...");

  const identifierHash = hashIdentifiers({
    accNo: account_no,
    ifscCode: capitalIfsc,
  });

  const accountPennyLessRateLimitResult = await checkingRateLimit({
    identifiers: { identifierHash },
    serviceId,
    categoryId,
    clientId: storingClient,
  });

  if (!accountPennyLessRateLimitResult?.allowed) {
    return res.status(429).json({
      success: false,
      message: accountPennyLessRateLimitResult?.message,
    });
  }

  const tnId = genrateUniqueServiceId();
  accountLogger.info(`account penny drop txn Id ===>> ${tnId}`);
  let maintainanceResponse;
  if (req.environment?.toLowercase() == "test") {
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

  try {
    const encryptedAccountNumber = encryptData(account_no);

    const existingAccountDetails = await accountdataModel.findOne({
      accountNo: encryptedAccountNumber,
      accountIFSCCode: ifsc,
    });
    if (existingAccountDetails) {
      const response = {
        BeneficiaryName: existingAccountDetails?.accountHolderName,
        AccountNumber: existingAccountDetails?.accountNo,
        IFSC: existingAccountDetails?.accountIFSCCode,
        Message:
          existingAccountDetails?.responseData?.result?.verification_status,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: response,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      return res.status(200).json(createApiResponse(200, response, "Valid"));
    }
    const service = await selectService("ACCOUNT_VERIFY_PL");

    console.log(
      "----active service for Account penny less Verify is ----",
      service,
    );
    accountLogger.info(
      `----active service for Account penny less Verify is ----, ${service}`,
    );
    if (!service) {
      return res
        .status(404)
        .json(createApiResponse(404, null, "Requested resource not found"));
    }

    console.log("----active service name for Account ---", service.serviceFor);
    accountLogger.info(
      `----active service name for Account --- ${service.serviceFor}`,
    );

    // let response;
    // switch (service.serviceFor) {
    //   case "INVINCIBLE":
    //     console.log("Calling INVINCIBLE API...");
    //     response = await verifyBankInvincible(data);
    //     break;
    //   case "TRUTHSCREEN":
    //     console.log("Calling TRUTHSCREEN API...");
    //     response = await verifyBankTruthScreen(data);
    //     break;
    //   default:
    //     throw new Error("Unsupported PAN service");
    // }

    const response = await accountPennyLessSerciveResponse(
      { account_no, ifsc },
      service,
      0,
    );
    console.log(
      "response from active service for account verify ===>>",
      response,
    );
    accountLogger.info(
      `response from active service for account verify ===>> ${response}`,
    );
    if (response?.message?.toLowerCase() == "valid") {
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: ifsc,
        status: 1,
        accountHolderName: response?.result?.name,
        serviceResponse: response?.responseOfService,
        responseData: response?.result,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      await accountdataModel.create(objectToStoreInDb);

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: ifsc,
        accountHolderName: "",
        serviceResponse: {},
        status: 2,
        responseData: ERROR_CODES?.NOT_FOUND,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);
      return res.status(200).json(createApiResponse(200, {}, "InValid"));
    }
  } catch (error) {
    console.error("Error verifying bank account verifyBankAccount:", error);
    const errorObj = mapError(err);
    return res
      .status(errorObj.httpCode)
      .json(createApiResponse(500, {}, "Server Error"));
  }
};
