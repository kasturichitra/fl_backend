const panverificationModel = require("../models/panverification.model");
const panDobModel = require("../models/panDob.model");
const panHolderDetails = require("../models/panHolderName.model");
const axios = require("axios");
require("dotenv").config();
const ServiceTrackingModel = require("../../ServiceTrackingModel/models/newServiceTrackingModel");
const logger = require("../../Logger/logger");
const {
  encryptData,
  decryptData,
} = require("../../../utlis/EncryptAndDecrypt");
const {
  updateFailure,
  selectService,
} = require("../../service/serviceSelector");
const { ERROR_CODES, mapError } = require("../../../utlis/errorCodes");
const { verifyPanInvincible } = require("../../service/provider.invincible");
const { verifyPanTruthScreen } = require("../../service/provider.truthscreen");
const { verifyPanZoop } = require("../../service/provider.zoop");
const panToAadhaarModel = require("../models/panToAadhaarModel");
const { checkingOfLength } = require("../../../utlis/lengthCheck");

function compareNames(fName, sName) {
  const distance = levenshteinDistance(fName, sName);
  const maxLength = Math.max(fName.length, sName.length);
  const similarity = 1 - distance / maxLength;
  return similarity * 100;
}
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
exports.verifyPanHolderName = async (req, res, next) => {
  const { panNumber, name } = req.body;
  console.log("pan number from frontend===>", panNumber);

  const MerchantId = req.merchantId;
  const check = req.token;

  if (!panNumber || !name) {
    let errorMessage = {
      message: "PAN number and Name are mandatory fields",
      statusCode: 400,
    };
    return next(errorMessage);
  }

  try {
    const existingPanNumber = await panverificationModel.findOne({
      panNumber: panNumber,
    });
    const existingPanHolderName = await panHolderDetails.findOne({
      panNumber: panNumber,
    });
    console.log("existingPanNumber===>", existingPanNumber);
    console.log("existingPanHolderName===>", existingPanHolderName);
    const panUsername = existingPanNumber?.userName;
    console.log("==============>>>>", panUsername);
    if (existingPanNumber && !existingPanHolderName) {
      console.log("single having");
      if (panUsername == name) {
        console.log("new record");
        const newData = await panHolderDetails.create({
          panNumber: panNumber,
          verificationName: name,
          result: `Your name is exactly matched with your pan card Name`,
          token: check,
          MerchantId: MerchantId,
          responseData: existingPanNumber?.response,
          createdDate: new Date().toLocaleDateString(),
          createdTime: new Date().toLocaleTimeString(),
        });
        console.log("new Record Saved");

        return res.status(200).json({
          success: true,
          message: "valid",
          response: newData?.result,
        });
      } else {
        console.log("panUsernnnnnnname===>>", panUsername);
        const result = compareNames(panUsername, name);

        if (result > 90) {
          console.log("if====>>>");
          const comparedData = await panHolderDetails.create({
            panNumber: panNumber,
            verificationName: name,
            result: `Your name is matched with your pan card Name with accuracy ${result}`,
            token: check,
            MerchantId: MerchantId,
            responseData: existingPanNumber?.response,
            createdDate: new Date().toLocaleDateString(),
            createdTime: new Date().toLocaleTimeString(),
          });
          res.status(200).json({
            success: true,
            message: "valid",
            response: comparedData?.result,
          });
        } else {
          console.log("elseeeeee===>>", result);

          let errorMessage = {
            message: `No Match Found Between the Names`,
            statusCode: 404,
          };
          return next(errorMessage);
        }
        console.log("end of iffff===>>", result);
      }
    } else if (existingPanNumber && existingPanHolderName) {
      console.log("having in both tables");
      console.log(
        "====>>both records are existing",
        name,
        existingPanHolderName?.verificationName
      );
      if (name == existingPanHolderName?.verificationName) {
        const resultedData = existingPanHolderName?.result;
        return res.status(200).json({
          success: true,
          message: "valid",
          response: resultedData,
        });
      } else if (name != existingPanHolderName?.verificationName) {
        console.log("=====>>>>Not matching of verification name and name");
        if (panUsername == name) {
          console.log(
            "names in pan and name given are same",
            panUsername,
            name
          );
          const newData = await panHolderDetails.create({
            panNumber: panNumber,
            verificationName: name,
            result: `Your name is exactly matched with your pan card Name`,
            token: check,
            MerchantId: MerchantId,
            responseData: existingPanNumber?.response,
            createdDate: new Date().toLocaleDateString(),
            createdTime: new Date().toLocaleTimeString(),
          });

          console.log("new Record Saved");

          return res.status(200).json({
            success: true,
            message: "valid",
            response: newData?.result,
          });
        } else if (panUsername != name) {
          const result = compareNames(panUsername, name);

          if (result > 90) {
            console.log("if====>>>", "both having result ", result);
            const comparedData = await panHolderDetails.create({
              panNumber: panNumber,
              verificationName: name,
              result: `Your name is matched with your pan card Name with accuracy ${result}`,
              token: check,
              MerchantId: MerchantId,
              responseData: existingPanNumber?.response,
              createdDate: new Date().toLocaleDateString(),
              createdTime: new Date().toLocaleTimeString(),
            });
            res.status(200).json({
              success: true,
              message: "valid",
              response: comparedData?.result,
            });
          } else {
            let errorMessage = {
              message: `No Match Found Between the Names`,
              statusCode: 404,
            };
            return next(errorMessage);
          }
        } else {
          let errorMessage = {
            message: `No Match Found Between the Names`,
            statusCode: 404,
          };
          return next(errorMessage);
        }
      } else {
        let errorMessage = {
          message: `No Match Found Between the Names`,
          statusCode: 404,
        };
        return next(errorMessage);
      }
    } else {
      const activeService = await ServiceTrackingModel.findOne({
        serviceFor: "Pan",
        serviceStatus: "Active",
      });
      console.log("activeService====>", activeService);
      if (activeService) {
        if (activeService?.serviceName === "Invincible") {
          const response = await invinciblePanVerification(
            panNumber,
            check,
            MerchantId
          );
          console.log(response);
          if (response.message == "Valid") {
            const panNameStored =
              response?.result?.result?.FIRST_NAME +
              response?.result?.result?.MIDDLE_NAME +
              response?.result?.result?.LAST_NAME;
            console.log("=====>>>>>pan name from invincible", panNameStored);
            if (panNameStored == name) {
              const newData = await panHolderDetails.create({
                panNumber: panNumber,
                verificationName: name,
                result: `Your name is exactly matched with your pan card Name`,
                token: check,
                MerchantId: MerchantId,
                responseData: existingPanNumber?.response,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
              });

              console.log("new Record Saved");

              return res.status(200).json({
                success: true,
                message: "valid",
                response: newData?.result,
              });
            } else if (panNameStored !== name) {
              const result = compareNames(panNameStored, name);

              if (result > 90) {
                console.log("if====>>>");
                const comparedData = await panHolderDetails.create({
                  panNumber: panNumber,
                  verificationName: name,
                  result: `Your name is matched with your pan card Name with accuracy ${result}`,
                  token: check,
                  MerchantId: MerchantId,
                  responseData: existingPanNumber?.response,
                  createdDate: new Date().toLocaleDateString(),
                  createdTime: new Date().toLocaleTimeString(),
                });
                res.status(200).json({
                  success: true,
                  message: "valid",
                  response: comparedData?.result,
                });
              } else {
                let errorMessage = {
                  message: `No Match Found Between the Names`,
                  statusCode: 404,
                };
                return next(errorMessage);
              }
            } else {
              let errorMessage = {
                message: `No Match Found Between the Names`,
                statusCode: 404,
              };
              return next(errorMessage);
            }
          }
          if (response.message == "NoDataFound") {
            let errorMessage = {
              message: `No Data Found for this panNumber ${panNumber}`,
              statusCode: 404,
            };
            return next(errorMessage);
          }
          if (response.message == "NoBalance") {
            let errorMessage = {
              message: `No Balance for this verification`,
              statusCode: 404,
            };
            return next(errorMessage);
          }
        } else if (activeService?.serviceName === "Zoop") {
          const response = await zoopPanVerification(
            panNumber,
            check,
            MerchantId
          );
          console.log("response from zoop............", response);
          const username = response?.username;
          console.log(response);
          if (response.message == "Valid") {
            const panNameStored = response?.result?.result?.user_full_name;
            console.log("====>>>panNameStored in zoop", panNameStored);
            if (panNameStored == name) {
              const newData = await panHolderDetails.create({
                panNumber: panNumber,
                verificationName: name,
                result: `Your name is exactly matched with your pan card Name`,
                token: check,
                MerchantId: MerchantId,
                responseData: existingPanNumber?.response,
                createdDate: new Date().toLocaleDateString(),
                createdTime: new Date().toLocaleTimeString(),
              });

              console.log("new Record Saved");

              return res.status(200).json({
                success: true,
                message: "valid",
                response: newData?.result,
              });
            } else if (panNameStored != name) {
              const result = compareNames(panNameStored, name);

              if (result > 90) {
                console.log("if====>>>");
                const comparedData = await panHolderDetails.create({
                  panNumber: panNumber,
                  verificationName: name,
                  result: `Your name is matched with your pan card Name with accuracy ${result}`,
                  token: check,
                  MerchantId: MerchantId,
                  responseData: existingPanNumber?.response,
                  createdDate: new Date().toLocaleDateString(),
                  createdTime: new Date().toLocaleTimeString(),
                });
                res.status(200).json({
                  success: true,
                  message: "valid",
                  response: comparedData?.result,
                });
              } else {
                let errorMessage = {
                  message: `No Match Found Between the Names`,
                  statusCode: 404,
                };
                return next(errorMessage);
              }
            } else {
              let errorMessage = {
                message: `No Match Found Between the Names`,
                statusCode: 404,
              };
              return next(errorMessage);
            }
          }
          if (response.message == "NoDataFound") {
            let errorMessage = {
              message: `No Data Found for this panNumber ${panNumber}`,
              statusCode: 404,
            };
            return next(errorMessage);
          }
        }
      } else {
        console.log("No active service available");
        let errorMessage = {
          message: "No Active Service Available",
          statusCode: 404,
        };
        return next(errorMessage);
      }
    }
  } catch (error) {
    console.log("Error in PAN verification:", error);
    if (error.response) {
      let errorMessage = {
        message: error?.response?.data,
        statusCode: 500,
      };
      return next(errorMessage);
    } else if (error.request) {
      let errorMessage = {
        message: "No response received from server",
        statusCode: 500,
      };
      return next(errorMessage);
    } else {
      let errorMessage = {
        message: "Error in PAN verification Try again after some time",
        statusCode: 500,
      };
      return next(errorMessage);
    }
  }
};
exports.dobverify = async (req, res, next) => {
  const { panNumber } = req.body;
  console.log("pan number from frontend===>", panNumber);
  const MerchantId = req.merchantId;
  const check = req.token;

  if (!panNumber) {
    let errorMessage = {
      message: "PAN number is mandatory field",
      statusCode: 400,
    };
    return next(errorMessage);
  }

  try {
    const existingPanNumber = await panverificationModel.findOne({
      panNumber: panNumber,
    });
    console.log("existingPanNumber===>", existingPanNumber);
    const dobExisting = await panDobModel.findOne({
      panNumber: panNumber,
    });
    if (existingPanNumber && !dobExisting) {
      const userDob = existingPanNumber?.response?.result?.DOB;
      const Data = existingPanNumber?.response?.result;
      const newRecord = await panDobModel.create({
        panNumber: panNumber,
        responseData: Data,
        token: check,
        MerchantId: MerchantId,
        result: `Your Date of Birth in Pan is ${userDob}`,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      });
      res
        .status(200)
        .json({ message: "valid", success: true, response: newRecord?.result });
    } else if (existingPanNumber && dobExisting) {
      const resp = dobExisting?.result;
      res
        .status(200)
        .json({ message: { message: "valid", success: true, result: resp } });
    } else {
      const response = await invinciblePanVerification(
        panNumber,
        check,
        MerchantId
      );
      console.log(response);
      if (response.message == "Valid") {
        const newRecord = await panDobModel.create({
          panNumber: panNumber,
          responseData: response?.result?.result,
          token: check,
          MerchantId: MerchantId,
          result: `Your Date of Birth in Pan is ${response?.result?.result?.DOB}`,
          createdDate: new Date().toLocaleDateString(),
          createdTime: new Date().toLocaleTimeString(),
        });
        res.json({ response: newRecord?.result });
      }
      if (response.message == "NoDataFound") {
        let errorMessage = {
          message: `No Data Found for this panNumber ${panNumber}`,
          statusCode: 404,
        };
        return next(errorMessage);
      }
      if (response.message == "NoBalance") {
        let errorMessage = {
          message: `No Balance for this verification`,
          statusCode: 404,
        };
        return next(errorMessage);
      }
    }
  } catch (error) {
    console.log("Error in PAN verification:", error);
    if (error.response) {
      let errorMessage = {
        message: error?.response?.data,
        statusCode: 500,
      };
      return next(errorMessage);
    } else if (error.request) {
      let errorMessage = {
        message: "No response received from server",
        statusCode: 500,
      };
      return next(errorMessage);
    } else {
      let errorMessage = {
        message: "Error in PAN verification Try again after some time",
        statusCode: 500,
      };
      return next(errorMessage);
    }
  }
};
exports.verifyPanNumber = async (req, res) => {
  const data = req.body;
  const { panNumber } = data;
  const resOfLenth = checkingOfLength(panNumber, 10)
  if (resOfLenth || !panNumber?.match(
      /^[A-Za-z]{3}[PCHABGJLFTpchabgjlft][A-Za-z][0-9]{4}[A-Za-z]$/
    )) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  const encryptedPan = encryptData(panNumber);

  const existingPanNumber = await panverificationModel.findOne({
    panNumber: encryptedPan,
  });
  console.log("existingPanNumber===>", existingPanNumber);
  if (existingPanNumber) {
    const decryptedPanNumber = decryptData(existingPanNumber?.panNumber);
    const decryptedResponse = {
      ...existingPanNumber?.response,
      PAN: decryptedPanNumber,
    };
    return res.json({
      message: "Valid",
      response: decryptedResponse,
      success: true,
    });
  }

  const service = await selectService("PAN");

  console.log("----active service for pan Verify is ----", service);
  if (!service) {
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  console.log("----active service name for pan ---", service.serviceFor);

  try {
    let response;
    switch (service.serviceFor) {
      case "INVINCIBLE":
        console.log("Calling INVINCIBLE API...");
        response = await verifyPanInvincible(data);
        break;
      case "TRUTHSCREEN":
        console.log("Calling TRUTHSCREEN API...");
        response = await verifyPanTruthScreen(data);
        break;
      case "ZOOP":
        console.log("Calling ZOOP API...");
        response = await verifyPanZoop(data);
        break;
      default:
        throw new Error("Unsupported PAN service");
    }
    console.log(
      `response from active service for pan ${service.serviceFor} ${JSON.stringify(response)}`
    );
    logger.info(`response from active service for pan ${service.serviceFor} ${JSON.stringify(response)}`)
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.PAN);
      const encryptedResponse = {
        ...response?.result,
        PAN: encryptedPan,
      };
      const storingData = {
        panNumber: encryptedPan,
        userName: response?.result?.Name,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);

      return res.json({
        message: "Valid",
        response: response?.result,
        success: true,
      });
    } else {
      const invalidResponse = {
        PAN: panNumber,
        Name: "",
        PAN_Status: "",
        PAN_Holder_Type: "",
      };
      return res.json({
        message: "InValid",
        response: invalidResponse,
        success: false,
      });
    }

    // await resetSuccess(service);  // if want to implement it when continue three time serr is show then Freez the service
  } catch (error) {
    console.log("error in verifyPanNumber ===>>>", error)
    await updateFailure(service);
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
exports.verifyPanToAadhaar = async (req, res) => {
  const data = req.body;
  const { panNumber } = data;

  const resOfLenth = checkingOfLength(panNumber, 10)
  if (resOfLenth || !panNumber?.match(
      /^[A-Za-z]{3}[PCHABGJLFTpchabgjlft][A-Za-z][0-9]{4}[A-Za-z]$/
    )) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  const encryptedPan = encryptData(panNumber);

  const existingPanNumber = await panToAadhaarModel.findOne({
    panNumber: encryptedPan,
  });
  console.log("existingPanNumber===>", existingPanNumber);
  if (existingPanNumber?.response?.code == 200) {
    return res.json({
      message: "Valid",
      success: true,
      response: existingPanNumber?.response,
    });
  }

   if (existingPanNumber?.response?.code == 404) {
    return res.json({
      message: "InValid",
      success: false,
      response: existingPanNumber?.response,
    });
  }

  try {
     const clientId = process.env.INVINCIBLE_CLIENT_ID;
    const secretKey = process.env.INVINCIBLE_SECRET_KEY;
    const url = "https://api.invincibleocean.com/invincible/panToMaskAadhaarLite";
    const headers = {
      clientId: clientId,
      secretKey: secretKey,
      "Content-Type": "application/json",
    };
    const panToAadhaarResponse = await axios.post(url, data, { headers });
    console.log("panToAadhaarResponse ===>>>", panToAadhaarResponse?.data)
    console.log(
      `response from service for pan to aadhaar ${JSON.stringify(panToAadhaarResponse?.data)}`
    );
    logger.info(`response from service for pan to aadhaar ${JSON.stringify(panToAadhaarResponse?.data)}`)

     if(panToAadhaarResponse?.data?.code == 404){
         const objectToStore = {
        panNumber: encryptedPan,
        aadhaarNumber: panToAadhaarResponse?.data?.result?.aadhaar,
        response: panToAadhaarResponse?.data,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      }

      await panToAadhaarModel.create(objectToStore);
      return res.status(404).json({
        message: "InValid",
        success: false,
        response: panToAadhaarResponse?.data
      })
    }

    if(panToAadhaarResponse?.data?.code == 200){
      const objectToStore = {
        panNumber: encryptedPan,
        aadhaarNumber: panToAadhaarResponse?.data?.result?.aadhaar,
        response: panToAadhaarResponse?.data,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      }

      await panToAadhaarModel.create(objectToStore);

      return res.status(200).json({
        message: "Valid",
        success: true,
        response: panToAadhaarResponse?.data
      })
    }

  } catch (error) {
    console.log("error in verifyPanNumber ===>>>", error)
    res
      .status(500)
      .json(ERROR_CODES?.SERVER_ERROR);
  }
};
