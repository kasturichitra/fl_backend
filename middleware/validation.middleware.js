  const loginAndSms = require('../api/loginAndSms/model/loginAndSmsModel'); // Adjust the path to your model

const validateMerchant = async (req, res, next) => {

  const check = req.token
  console.log(req.tokenData , "LJDJVDSJVJAV")

  try {
    const merchant = await loginAndSms.findOne({ token: check });

    if (!merchant) {
        let errorMessage = {
            message: "User not found",
            statusCode: 400,
          };
          return next(errorMessage);
    }

    const merchantId = merchant?.merchantId;
 

    if (!merchantId) {
        let errorMessage = {
            message: "Merchant ID not found for the user",
            statusCode: 400,
          };
          return next(errorMessage);
    }
    req.merchantId = merchantId;
    next(); 
  } catch (err) {
    next(err); 
  }
};

module.exports = validateMerchant;
