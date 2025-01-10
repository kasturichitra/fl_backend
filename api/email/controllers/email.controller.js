const jwt = require("jsonwebtoken");
const emailModel = require("../models/email.model");
//const response = require("../../../response");
const bcrypt = require("bcryptjs");
const crypto = require("../../../crypto");
const verify = require("../../../verify.token");

const merchantModel = require("../../merchant/models/merchant.model");

exports.storeEmail = async (req, res) => {
  console.log("triggered email call")
  try {
    const {  email } = req.body;


    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(400).json({ message: 'Authorization header is required' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }
    const isValidToken = verify.verify_token(token);
    console.log("isValidToken===>",isValidToken)
    if (!isValidToken) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if ( !email) {
      return res.status(400).json({ message: 'Token and email are required.' });
    }
    const merchant = await merchantModel.findOne({ token });
    if (!merchant) {
      console.log("user not found")
      return res.status(400).json({ message: 'UserNotExist' });
    }

    const MerchantId = merchant.MerchantId;
    if (!MerchantId) {
      return res.status(400).json({ message: 'UserNotExist' });
    }

    const existingEmail = await merchantModel.findOne({ email });
    if (existingEmail) {
      console.log("triggered already exist")
      return res.status(400).json({ message: 'AlreadyExist' });
    }
    const emails = await emailModel.findOne({MerchantId});
    console.log("emails==========================>",emails)
    if(!emails){
      const responseAfterSaving = await emailModel.create({ token, email, MerchantId });
    console.log('Email stored:', responseAfterSaving);
    }
    // Create a new entry in the emailModel with the provided email and token
    

    // Update the user document with the new email
    const responseAfterUpdate = await merchantModel.updateOne({ token }, { $set: { email } });
    console.log('Email updated for user:', responseAfterUpdate);

    res.status(201).json({ message: 'Email stored successfully.' });
  } catch (error) {
    console.log('Error storing email:', error);
    if (error.code === 11000 && error.keyPattern.email) {
      return res.status(400).json({ message: 'Email already exists.' });
    }
    res.status(500).json({ message: 'Failed to store email' });
  }
};







// exports.fetchAllUserEmails = async (req, res) => {
//   try {
//     // Fetch all user emails from the database
//     const emailsData = await emailModel.find({}, 'email');

//     if (!emailsData || emailsData.length === 0) {
//       return res.status(404).json({ message: 'No emails found' });
//     }

//     // Extract emails from the found data
//     const emails = emailsData.map(email => email.email);

//     // Return the emails as a response
//     res.json({ emails });
//   } catch (error) {
//     console.log('Error fetching user emails:', error);
//     res.status(500).json({ message: 'Failed to fetch user emails' });
//   }
// };



