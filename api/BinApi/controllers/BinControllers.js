const axios = require("axios");
require("dotenv").config();
const RapidApiModel = require("../models/BinApiModels");
const RapidApiBankModel = require("../models/BinApiBankModel");
const { verifyIfsc, verifyBinNumber } = require("../../service/provider.rapid");
const handleValidation = require("../../../utlis/lengthCheck");
let RapidApiKey = process.env.RAPIDAPI_KEY;
let RapidApiHost = process.env.RAPIDAPI_BIN_HOST;
let RapidApiBankHost = process.env.RAPIDAPI_IFSC_HOST;

exports.getCardDetailsByNumber = async (req, res) => {
  const { bin } = req.body;
  const data = req.body;
  
  console.log("bin detailes=---> ", bin);
  console.log("RAOPID_API KEY=---> ", RapidApiKey);
  console.log("RAPID Bin API HOST =---> ", RapidApiHost);
  console.log("RAPID Bank  API HOST =---> ", RapidApiBankHost);

  const isValid = handleValidation("bin", bin, res);
    if (!isValid) return;

  try {
    const exsistingDetails = await RapidApiModel.findOne({ bin });
    console.log(
      "==============================>>>>>bin existing",
      exsistingDetails
    );
    if (exsistingDetails) {
      return res.status(200).json({
        message: "valid",
        success: true,
        response: exsistingDetails?.response,
      });
    } else {
      const response = await verifyBinNumber(data);
      if (response) {
        console.log("response of bin in back end jus===>", response);
        let saveData = await RapidApiModel({
          bin: bin,
          response: response,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
        });
        let done = await saveData.save();
        if (done) {
          console.log("Data save to db successfully ");
        }
      }
      return res.status(200).json({
        message: "valid",
        success: true,
        response: response,
      });
    }
  } catch (error) {
    console.error("Error fetching BIN info:", error.message);
    res.status(500).json({ error: "Failed to fetch BIN information" });
  }
};

exports.getBankDetailsByIfsc = async (req, res) => {
  const { ifsc } = req.body;
    const data = req.body;
  console.log("IFSC Code:", ifsc);

  try {
    const existingBankDetails = await RapidApiBankModel.findOne({ Ifsc: ifsc });

    if (existingBankDetails) {
      return res.status(200).json({
        message: "valid",
        success: true,
        response: existingBankDetails?.response,
      });
    } else {
      const response = await verifyIfsc(data);
            console.log("Bank details fetched successfully:", response);
      if (response) {
        let saveData = await RapidApiBankModel({
          Ifsc: ifsc,
          response: response,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
        });
        let done = await saveData.save();
        if (done) {
          console.log("Bank Data save to db successfully ");
        }
      }
      return res.status(200).json({
        message: "Valid",
        success: true,
        response: response,
      });
    }
  } catch (error) {
    console.error("Error fetching Bank info:", error.message);
    res.status(500).json({ error: "Failed to fetch Bank information" });
  }
};
