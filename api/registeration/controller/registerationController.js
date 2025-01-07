const registeration = require("../model/registerationModel")
const bcrypt = require("bcrypt")
const logger = require("../../Logger/logger")


const generateMerchantId = () => {
  const currentDateTime = new Date();
  const timestamp = currentDateTime.getTime();
  return `MERCHANT${timestamp.toString().slice(-8)}`;
}

const registerationVerify = async (req, res, next) => {
  const { name, email, mobileNumber, password, companyName, ipAddress } = req.body
  console.log(req.body)

  if (!email || !mobileNumber || !password) {
    logger.info(`All Fields Should Be Filled`)
    let errorMessage = {
      message: "Email , MobileNumber and Password Fields are mandatory 😁",
      statusCode: 400,
    };
    return next(errorMessage);

  }
  try {
    const userWithMobileNumberOrEmail = await registeration.findOne({  $or: [
      { mobileNumber },
      { email }
    ]});
    // const userWithEmail = await registeration.findOne({ email });

    if (userWithMobileNumberOrEmail) {
      logger.info(`User with this mobile number or email already exists 😒`)
      let errorMessage = {
        message: "User with this mobile number or email already exists 😒",
        statusCode: 401,
      };
      return next(errorMessage);
    }


    if (!userWithMobileNumberOrEmail) {
      const hashedPassword = await bcrypt.hash(password, 10)
      const merchantId = generateMerchantId()

    const newUser = new registeration({
        name,
        email,
        mobileNumber,
        password: hashedPassword,
        ipAddress,
        companyName,
        merchantId,
        createdDate:new Date().toLocaleDateString(),
        createdTime:new Date().toLocaleTimeString()
      });

      const savedUser = await newUser.save();
      res.status(201).json({ user : savedUser , message : "Registeration Successfull"});
    }

  } catch (err) {
    logger.error("InternalServiceError")
    let errorMessage = {
      message: "InternalServiceError",
      statusCode: 500,
    };
    return next(errorMessage);
  }

}

const allUsers = async (req, res, next) => {
  try {
    const allUsers = await registeration.find({})

    if (allUsers.length > 0) {
      res.status(200).send(allUsers)
    }else{
      logger.error("No Users")
      let errorMessage = {
        message: "No users",
        statusCode: 404,
      };
      return next(errorMessage);
    }

  } catch (err) {
    logger.error("InternalServiceError")
    let errorMessage = {
      message: "InternalServiceError",
      statusCode: 500,
    };
    return next(errorMessage);
  }
}


module.exports = { registerationVerify, allUsers }