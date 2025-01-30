const testingModel = require("../models/testing.model");

function generatingApiKey(service) {
    const hashcode = Math.floor(100000 + Math.random() * 900000).toString();
    const firstWord = service.substring(0, 2);
    const currentDateTime = new Date();
    const timestamp = currentDateTime.getTime();
    const secondWord = timestamp.toString().slice(-8);

    const apiKey = `${firstWord}_${secondWord}_${hashcode}`;

    return apiKey;
}

function generationApiSalt(service) {
    const hashcode = Math.floor(100000 + Math.random() * 900000).toString();
    const firstWord = service.substring(0, 2);
    const currentDateTime = new Date();
    const timestamp = currentDateTime.getTime();
    const secondWord = timestamp.toString().slice(-8);

    const apisaltKey = `${firstWord}_${secondWord}_${hashcode}`;

    return apisaltKey;
}

const generateApiKeys = async (req, res, next) => {
    const { service } = req.body;
    console.log(service);

    // Ensure 'service' is provided
    if (!service) {
        return res.status(400).json({ message: "Service is required", success: false });
    }

    const MerchantId = req.merchantId;
    const check = req.token;

    try {
        console.log("try block");

        const testing_Api_key = generatingApiKey(service);
        const testing_Api_salt = generationApiSalt(service);

        console.log("========>>>>testing key and test salt key", testing_Api_key, testing_Api_salt);

        const existingKeysForService = await testingModel.findOne({ service: service, merchantId: MerchantId });

        if(existingKeysForService){
          const exsistingTestDetailsResponse = {
            test_key: existingKeysForService?.test_key,
            test_salt: existingKeysForService?.test_salt,
        };

        res.status(200).json({ message: "Valid", success: true, response: exsistingTestDetailsResponse });
        }else{
          const testDetails = await testingModel.create({
            MerchantId,
            token: check,
            service: service,
            test_key: testing_Api_key,
            test_salt: testing_Api_salt,
            limit: 3
        });
        console.log("======>testDetails", testDetails);
        }

        const testDetailsResponse = {
            test_key: testing_Api_key,
            test_salt: testing_Api_salt,
        };

        res.status(200).json({ message: "Valid", success: true, response: testDetailsResponse });

    } catch (error) {
      console.log("catch block");
      let errorMessage = {
        message: "Something went wrong, try again after some time",
        statusCode: 400,
      };
      return next(errorMessage);
    }
};

module.exports = generateApiKeys;
