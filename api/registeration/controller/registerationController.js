const logger = require("../../Logger/logger");
const registeration = require("../model/registerationModel")
const bcrypt = require("bcrypt")


const generateMerchantId = () => {
  const currentDateTime = new Date();
  const timestamp = currentDateTime.getTime();
  return `MERCHANT${timestamp.toString().slice(-8)}`;
}

const registerationVerify = async (req, res, next) => {
  const { mobileNumber, email, panNumber, panName, IPIN } = req.body
  console.log(req.body)

  if (!email || !mobileNumber || !panNumber || !panName || !IPIN) {
    // logger.info(`All Fields Should Be Filled`)
    let errorMessage = {
      message: "Email , MobileNumber, panNumber & panName Fields are mandatory 😁",
      statusCode: 400,
    };
    return next(errorMessage);

  }

  try {
    const userWithMobileNumberOrEmail = await registeration.findOne({
      $or: [
        { mobileNumber },
        { panNumber },
        { email }
      ]
    });
    if (userWithMobileNumberOrEmail) {
      // logger.info(`User with this mobile number or email already exists 😒`)
      let errorMessage = {
        message: "User with this mobile number or email already exists 😒",
        statusCode: 401,
        success:false,
        data:[]
      };
      return next(errorMessage);
    }

    if (!userWithMobileNumberOrEmail) {
      const hashedPassword = await bcrypt.hash(IPIN, 10);
      const hashedpanNumber = await bcrypt.hash(panNumber, 10);
      const merchantId = generateMerchantId()

      const newUser = new registeration({
        name: panName,
        email,
        mobileNumber,
        panNumber: hashedpanNumber,
        password: hashedPassword,
        merchantId,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString()
      });
      const savedUser = await newUser.save();
      res.status(201).json({ user: savedUser, message: "Registeration Successfull 😊", success: true });
    }

  } catch (err) {
    logger.error("InternalServiceError", err)
    let errorMessage = {
      message: "InternalServiceError",
      statusCode: 500,
    };
    return next(errorMessage);
  }

};

const allUsers = async (req, res, next) => {
  try {
    const allUsers = await registeration.find({})

    if (allUsers.length > 0) {
      res.status(200).send(allUsers)
    } else {
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
};

const updateUser = async (req, res, next) => {
  const { MerchantId } = req.body
  console.log(MerchantId)
  try {
    const user = await registeration.findOneAndUpdate({ merchantId: MerchantId }, req.body, { new: true })
    console.log(user, "=====>>>>>user updated")
    return res.status(200).json({ message: "Valid", success: true, response: "User Updated Successfully" })
  } catch (error) {
    let errorMessage = {
      message: "InternalServiceError",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};


module.exports = { registerationVerify, allUsers, updateUser }

