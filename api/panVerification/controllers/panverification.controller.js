const panverificationModel = require("../models/panverification.model");
const panDobModel = require("../models/panDob.model");
const panHolderDetails = require("../models/panHolderName.model");
const axios = require("axios");
require("dotenv").config();
const ServiceTrackingModel = require("../../ServiceTrackingModel/models/ServiceTrackingModel.model");
const logger = require("../../Logger/logger");

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
exports.verifyPan = async (req, res, next) => {
  const { panNumber } = req.body;
  console.log("pan number from frontend===>", panNumber);

  const MerchantId = req.merchantId;
  const check = req.token;

  if (!panNumber) {
    let errorMessage = {
      message: "PAN number is required",
      statusCode: 400,
    };
    return next(errorMessage);
  }

  try {
    const existingPanNumber = await panverificationModel.findOne({
      panNumber: panNumber,
    });
    console.log("existingPanNumber===>", existingPanNumber);
    if (existingPanNumber) {
      await panverificationModel.updateOne(
        { _id: existingPanNumber._id },
        { $set: { MerchantId: MerchantId, token: check } }
      );
      return res.status(200).json({ message: existingPanNumber?.response });
    }
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
          return res.json({ message: response?.result });
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
          return res.json({ message: response?.result });
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

async function invinciblePanVerification(panNumber, token, MerchantId) {
  try {
    const clientId = process.env.INVINCIBLE_CLIENT_ID;
    const secretKey = process.env.INVINCIBLE_SECRET_KEY;
    const url = "https://api.invincibleocean.com/invincible/panPlus";
    const headers = {
      clientId: clientId,
      secretKey: secretKey,
      "Content-Type": "application/json",
    };
    const data = { panNumber };
    const response = await axios.post(url, data, { headers });
    console.log("API response:", response.data);
    if (response.data.code === 404) {
      console.log(" pan data not found");
      return { message: "NoDataFound" };
    } else if (response.data.code === 402) {
      console.log("NoBalance");
      logger.info("NoBalance");
      return { message: "NoBalance" };
    }
    const obj = response.data;
    const result = obj.result || {};
    const firstName = result.FIRST_NAME || "";
    const middleName = result.MIDDLE_NAME || "";
    const lastName = result.LAST_NAME || "";

    const username = [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ");
    const panData = {
      panNumber,
      response: obj,
      token,
      MerchantId,
      userName: username,
      createdDate: new Date().toLocaleDateString(),
      createdTime: new Date().toLocaleTimeString(),
    };
    const newpanVerification = await panverificationModel.create(panData);
    return { result: response.data, message: "Valid" };
  } catch (error) {
    console.log("Error performing PAN verification:", error);
    console.log("error.response in pan verification====>", error.response);
    if (error.response) {
      throw new Error(error.response.data);
    } else if (error.request) {
      throw new Error("No response received from server");
    } else {
      throw new Error(error.message);
    }
  }
}
async function zoopPanVerification(panNumber, token, MerchantId) {
  try {
    const options = {
      method: "POST",
      url: "https://live.zoop.one/api/v1/in/identity/pan/lite",
      headers: {
        "app-id": process.env.ZOOP_APP_ID,
        "api-key": process.env.ZOOP_API_KEY,
        "Content-Type": "application/json",
        "org-id": process.env.ZOOP_ORG_ID,
      },
      data: {
        mode: "sync",
        data: {
          customer_pan_number: panNumber,
          consent: "Y",
          consent_text: "Iconsenttothisinformationbeingsharedwithzoop.one",
        },
      },
    };

    const response = await axios(options);

    // Parse the response body
    const obj = response.data;
    console.log(obj);
    if (obj.response_code === "101") {
      return { message: "NoDataFound" };
    }
    const pancardNumber = obj.result.pan_number;
    const username = obj.result.user_full_name;

    // Save the PAN verification data to your MongoDB collection
    const panVerificationData = {
      panNumber,
      response: obj,
      token,
      MerchantId,
      userName: username,
      createdDate: new Date().toLocaleDateString(),
      createdTime: new Date().toLocaleTimeString(),
    };

    await panverificationModel.create(panVerificationData);
    return { result: response.data, message: "Valid" };
  } catch (error) {
    console.log("Error performing PAN verification:", error);
    throw new Error("Failed to perform PAN verification");
  }
}
