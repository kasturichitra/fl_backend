require("dotenv").config();
const { ERROR_CODES, mapError } = require("../../../utils/errorCodes");
const handleValidation = require("../../../utils/lengthCheck");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const analyticsModel = require("../model/analyticsModel");
const { response } = require("express");

exports.AnaliticsData = async (req, res) => {
  console.log("entered into AnaliticsData")
  try {
    const analyticsData = await analyticsModel.find({});
    console.log("analyticsData in analyticaldata",analyticsData)
    console.log("analyticsData in analyticaldata length",analyticsData.length)
    return res.status(200).json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    console.log("error in displaying analyticsdata", error);
    return res.status(500).json({
      success: false,
      message: "server error"
    });
  }
};




