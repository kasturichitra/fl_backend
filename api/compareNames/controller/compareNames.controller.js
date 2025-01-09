const checkingDetails = require("../../../middleware/authorization");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");
const comparingNamesModel = require("../models/compareName.model")

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

exports.compareNames = async (req, res, next) => {
  try {
    const { firstName, secondName } = req.body;
    const authHeader = req.headers.authorization;

    const check = await checkingDetails(authHeader , next)

    if (!firstName || !secondName) {
        let errorMessage = {
          message: "Both Names are Required",
          statusCode: 400,
        };
        return next(errorMessage);
       }

    const merchantDetails = await loginAndSms.findOne({ token:check });

    const MerchantId = merchantDetails?.merchantId;
    if (!MerchantId) {
        let errorMessage = {
            message: "You are not authorized for this verification",
            statusCode: 400,
          };
          return next(errorMessage);
    }
    console.log("merchant id in account===>", MerchantId);

    const existingDetails = await comparingNamesModel.findOne({ firstName: firstName , secondName:secondName  });
    if (existingDetails) {
      console.log("response in existing===>", existingDetails?.responseData);
      const response = {
        firstName : existingDetails?.firstName,
        secondName : existingDetails?.secondName,
        responseData : existingDetails?.responseData
      }
      return res.status(200).json(response)     
    }else{
      const result = await compareNames(firstName , secondName)
      console.log("======>>>>>result in compareNames" , result)

      if(result > 30){
        const newSet = await comparingNamesModel.create({
          firstName : firstName,
          secondName : secondName,
          MerchantId : MerchantId,
          token : check,
          responseData : {
            data : `Your Name Comparison Comes with a accuracy of ${result}`
          },
          createdDate:new Date().toLocaleDateString(),
          createdTime:new Date().toLocaleTimeString()
        })
        const response = {
          secondName : secondName,
          MerchantId : MerchantId,
          responseData : {
            data : `Your Name Comparison Comes with a accuracy of ${result}`
          },
        }
        return res.status(200).json(response)
      }else{
        let errorMessage = {
          message: "No Match Found",
          statusCode: 404,
        };
        return next(errorMessage);
      }
    }
  } catch (error) {
    console.log('Error performing comparing Names:', error.response?.data || error.message);
    let errorMessage = {
      message: "Error performing comparing Names Try again after Some time",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};

