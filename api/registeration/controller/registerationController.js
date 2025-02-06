// const registeration = require("../model/registerationModel")
// const bcrypt = require("bcrypt")
// const //logger = require("../..///logger///logger")
// const Whitelistapi = require("../../whitelistapi/models/whitelistapi.models")


// const generateMerchantId = () => {
//   const currentDateTime = new Date();
//   const timestamp = currentDateTime.getTime();
//   return `MERCHANT${timestamp.toString().slice(-8)}`;
// }

// const registerationVerify = async (req, res, next) => {
//   const { name, email, mobileNumber, password, companyName, ipAddress } = req.body
//   console.log(req.body)

//   if (!email || !mobileNumber || !password) {
//     //logger.info(`All Fields Should Be Filled`)
//     let errorMessage = {
//       message: "Email , MobileNumber and Password Fields are mandatory 😁",
//       statusCode: 400,
//     };
//     return next(errorMessage);

//   }
//   try {
//     const userWithMobileNumberOrEmail = await registeration.findOne({  $or: [
//       { mobileNumber },
//       { email }
//     ]});
//     // const userWithEmail = await registeration.findOne({ email });

//     if (userWithMobileNumberOrEmail) {
//       //logger.info(`User with this mobile number or email already exists 😒`)
//       let errorMessage = {
//         message: "User with this mobile number or email already exists 😒",
//         statusCode: 401,
//       };
//       return next(errorMessage);
//     }


//     if (!userWithMobileNumberOrEmail) {
//       const hashedPassword = await bcrypt.hash(password, 10)
//       const merchantId =  generateMerchantId()

//     const newUser = new registeration({
//         name,
//         email,
//         mobileNumber,
//         password: hashedPassword,
//         ipAddress,
//         companyName,
//         merchantId,
//         createdDate:new Date().toLocaleDateString(),
//         createdTime:new Date().toLocaleTimeString()
//       });
//       const IpModule = await Whitelistapi.findOne({ merchantId })
//       if (!IpModule) {
//         const newwhitelistIPModule = new Whitelistapi({
//           MerchantId: req.merchantId
//         })
//         await newwhitelistIPModule.save()
//       }
//       const savedUser = await newUser.save();
//       res.status(201).json({ user : savedUser , message : "Registeration Successfull 😊"});
//     }

//   } catch (err) {
//     //logger.error("InternalServiceError")
//     let errorMessage = {
//       message: "InternalServiceError",
//       statusCode: 500,
//     };
//     return next(errorMessage);
//   }

// }

// const allUsers = async (req, res, next) => {
//   try {
//     const allUsers = await registeration.find({})

//     if (allUsers.length > 0) {
//       res.status(200).send(allUsers)
//     }else{
//       //logger.error("No Users")
//       let errorMessage = {
//         message: "No users",
//         statusCode: 404,
//       };
//       return next(errorMessage);
//     }

//   } catch (err) {
//     //logger.error("InternalServiceError")
//     let errorMessage = {
//       message: "InternalServiceError",
//       statusCode: 500,
//     };
//     return next(errorMessage);
//   }
// }


// module.exports = { registerationVerify, allUsers }



const registeration = require("../model/registerationModel");
const bcrypt = require("bcrypt");
// const //logger = require("../..///logger///logger");
const Whitelistapi = require("../../whitelistapi/models/whitelistapi.models");
const { Op } = require("sequelize"); // Only needed for Sequelize queries

const generateMerchantId = () => {
  const timestamp = Date.now(); // More efficient than creating a Date object
  return `MERCHANT${timestamp.toString().slice(-8)}`;
};

const registerationVerify = async (req, res, next) => {
  try {
    const { name, email, mobileNumber, password, companyName, ipAddress } = req.body;
    
    if (!email || !mobileNumber || !password) {
      //logger.info("All Fields Should Be Filled");
      return next({
        message: "Email, Mobile Number, and Password fields are mandatory 😁",
        statusCode: 400,
      });
    }

    // Check if a user with the same email or mobile number already exists
    const userWithMobileNumberOrEmail = await registeration.findOne({
      where: {
        [Op.or]: [{ mobileNumber }, { email }]
      }
    });

    if (userWithMobileNumberOrEmail) {
      //logger.info("User with this mobile number or email already exists 😒");
      return next({
        message: "User with this mobile number or email already exists 😒",
        statusCode: 401,
      });
    }

    // Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10);
    const merchantId = generateMerchantId();

    // Create a new user
    const newUser = await registeration.create({
      name,
      email,
      mobileNumber,
      password: hashedPassword,
      ipAddress,
      companyName,
      merchantId,
      createdDate: new Date().toISOString().split("T")[0], // YYYY-MM-DD
      createdTime: new Date().toISOString().split("T")[1].split(".")[0] // HH:MM:SS
    });

    // Check if a whitelist record exists for this merchant
    const existingWhitelist = await Whitelistapi.findOne({ where: { merchantId } });
    if (!existingWhitelist) {
      await Whitelistapi.create({ merchantId });
    }

    return res.status(201).json({ user: newUser, message: "Registration Successful 😊" });

  } catch (err) {
    //logger.error("Internal Service Error", err);
    return next({
      message: "Internal Service Error",
      statusCode: 500,
    });
  }
};

const allUsers = async (req, res, next) => {
  try {
    const users = await registeration.find({}); 
    if (users.length === 0) {
      //logger.error("No Users Found");
      return next({
        message: "No users found",
        statusCode: 404,
      });
    }
    return res.status(200).json(users);
  } catch (err) {
    //logger.error("Internal Service Error", err);
    return next({
      message: "Internal Service Error",
      statusCode: 500,
    });
  }
};

module.exports = { registerationVerify, allUsers };
