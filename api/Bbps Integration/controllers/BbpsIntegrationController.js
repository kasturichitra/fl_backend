const crypto = require("crypto");
const axios = require("axios");
const xml2js = require("xml2js");
// const BBPS_IntegrationModel = require("../models/bbpsintegration.model");
const BbpsIntegrationModel = require("../models/BbpsIntegrationModel")
const logger = require("../../Logger/Logger");
const { encryptData, decryptData } = require("../../../utlis/bbpsencryption");
const SECRET_KEY = process.env.BBPS_SECRETKEY_MERCHANT;
const ACCESS_CODE = process.env.ACCESS_CODE_MERCHANT;
const VERSION = process.env.VERSION_MERCHANT;
const INSTITUTE_ID = process.env.INSTITUTE_ID_MERCHANT;
const AGENT_ID = process.env.BBPS_AGENTID_MERCHANT_AGT;
const INIT_CHANNEL = process.env.BBPS_INITCHANNEL_MERCHANT_AGT;
function generateRandomCharacters(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
function generateJulianDateTime() {
  const now = new Date();
  const yearLastDigit = now.getFullYear().toString().slice(-1);
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay).toString().padStart(3, "0");
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  return `${yearLastDigit}${dayOfYear}${hours}${minutes}`;
}
function generateRequestId() {
  const randomPart = crypto.randomBytes(20).toString("hex").substring(0, 27).toUpperCase();

  const now = new Date();
  const istOffset = 5.5 * 60;
  const nowIST = new Date(now.getTime() + istOffset * 60 * 1000);

  const year = nowIST.getFullYear().toString();
  const Y = year.slice(-1);

  const start = new Date(nowIST.getFullYear(), 0, 0);
  const diff = nowIST - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const DDD = String(Math.floor(diff / oneDay)).padStart(3, "0");

  const hh = String(nowIST.getHours()).padStart(2, "0");
  const mm = String(nowIST.getMinutes()).padStart(2, "0");

  const formattedPart = `${Y}${DDD}${hh}${mm}`;
  const requestId = `${randomPart}${formattedPart}`;

  console.log("Generated Request ID (IST):", requestId);
  return requestId;
}
function parseXmlToJson(xmlString) {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
    parser.parseString(xmlString, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
exports.bbpsBillerInfo = async (req, res) => {
  const { billerId } = req.body;
  logger.info(`BBPS Biller Info Request Triggered | billerId: ${billerId}`);

  if (!billerId) {
    logger.warn("Missing billerId in request body");
    return res.status(400).json({ error: "billerId is required" });
  }

  const requestId = generateRequestId();

  try {
    const existingBiller = await BbpsIntegrationModel.findOne({
      "jsonData.billerInfoResponse.biller.billerId": billerId,
    });

    if (existingBiller) {
      logger.info(`Existing biller found for billerId ${billerId}, returning cached response`);
      return res.status(200).json({ jsonData: existingBiller.jsonData });
    }
    const plainXML = `<?xml version="1.0" encoding="UTF-8"?>
<billerInfoRequest>
  <billerId>${billerId}</billerId>
</billerInfoRequest>`;

    logger.info(` Plain XML to encrypt: ${plainXML}`);

    const encryptedRequest = await encryptData(plainXML);
    logger.info(`Encrypted Request: ${encryptedRequest.substring(0, 80)}...`);

    const url = `https://api.billavenue.com/billpay/extMdmCntrl/mdmRequestNew/xml`;
    const config = {
      params: {
        accessCode: process.env.ACCESS_CODE_MERCHANT,
        ver: process.env.VERSION_MERCHANT,
        instituteId: process.env.INSTITUTE_ID_MERCHANT,
        requestId,
      },
      headers: { "Content-Type": "text/plain" },
    };
    logger.info(`Sending encrypted request to BillAvenue: ${url}`);
    const response = await axios.post(url, encryptedRequest, config);
    logger.info(`Raw Response Received (Encrypted): ${response.data.substring(0, 100)}...`);
    const decryptedResponse = await decryptData(response.data);
    logger.info(`Decrypted XML Response: ${decryptedResponse}`);
    const jsonData = await parseXmlToJson(decryptedResponse);
    logger.info(`Parsed JSON Response: ${JSON.stringify(jsonData)}`);
    await BbpsIntegrationModel.create({
      billType: "billerInfo",
      billerId: billerId,
      requestId: requestId,
      jsonData: jsonData,

    });

    logger.info(`Biller Info Stored | Request ID: ${requestId}`);
    res.status(200).json({
      message: "Valid",
      success: true,
      requestId,
      jsonData,
    });

  } catch (error) {
    logger.error(`Error in convertToEncrypt: ${error.message}`);
    console.error("Detailed Error:", error);
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
};
exports.bbpsBillFetch = async (req, res) => {
  console.log("Bill Fetch API Triggered");
  try {
    const requestId = generateRequestId();
    const { billerId, mobileNumber, inputParams } = req.body;

    let xmlData = `
      <billFetchRequest>
        <agentId>${AGENT_ID}</agentId>
        <agentDeviceInfo>
          <ip>192.168.1.1</ip>
          <initChannel>${INIT_CHANNEL}</initChannel>
          <mac></mac>
          <app>AIAPP</app>
          <os>Android</os>
          <imei>863018050520673</imei>
        </agentDeviceInfo>
        <customerInfo>
          <customerMobile>${mobileNumber}</customerMobile>
        </customerInfo>
        <billerId>${billerId}</billerId>
        <inputParams>`;

    for (const [key, value] of Object.entries(inputParams)) {
      xmlData += `
          <input>
            <paramName>${key}</paramName>
            <paramValue>${value}</paramValue>
          </input>`;
    }

    xmlData += `
        </inputParams>
      </billFetchRequest>
    `;

    console.log("XML Request:\n", xmlData);

    const encryptedXML = await encryptData(xmlData);
    console.log("Encrypted XML:", encryptedXML);

    const url = `https://api.billavenue.com/billpay/extBillCntrl/billFetchRequest/xml?accessCode=${ACCESS_CODE}&requestId=${requestId}&ver=${VERSION}&instituteId=${INSTITUTE_ID}&encRequest=${encryptedXML}`;
    console.log("BillAvenue URL:", url);
    const response = await axios.post(url);
    console.log("Raw Encrypted Response:", response.data);
    const decryptedResponse = await decryptData(response.data);
    console.log("Decrypted Response:\n", decryptedResponse);
    const jsonResponse = await parseXmlToJson(decryptedResponse);
    console.log("JSON Response:", JSON.stringify(jsonResponse, null, 2));
    await BbpsIntegrationModel.create({
      billType: "billFetch",
      requestId,
      billerId: billerId,
      jsonData: jsonResponse,
    });
    res.status(200).json({
      success: true,
      message: "Valid",
      requestId,
      data: jsonResponse,
    });

  } catch (error) {
    console.error("Bill Fetch Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Bill Fetch Failed",
      error: error.message,
    });
  }
};
exports.billPayRequest = async (req, res) => {
  console.log("BBPS Bill Pay Request Triggered");

  try {
    const requestId = generateRequestId();
    const {
      billerId,
      ip,
      initChannel,
      mac,
      app,
      os,
      imei,
      mobileNumber,
      customerEmail,
      customerAdhaar,
      customerPan,
      inputParams,
      billerResponse,
      additionalInfo,
      amount,
      currency,
      custConvFee,
      paymentMode,
      quickPay,
      splitPay,
      paymentInfo
    } = req.body;
    let xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<billPaymentRequest>
  <agentId>${AGENT_ID}</agentId>
  <billerAdhoc>true</billerAdhoc>
  <agentDeviceInfo>
    <ip>${ip || "192.168.0.3"}</ip>
    <initChannel>${INIT_CHANNEL}</initChannel>
    <mac></mac>
          <app>AIAPP</app>
          <os>Android</os>
          <imei>863018050520673</imei>
  </agentDeviceInfo>
  <customerInfo>
    <REMITTER_NAME></REMITTER_NAME>
    <customerMobile>${mobileNumber}</customerMobile>
    <customerEmail></customerEmail>
    <customerAdhaar></customerAdhaar>
    <customerPan></customerPan>
  </customerInfo>
  <billerId>${billerId}</billerId>
  <inputParams>`;
    for (const [paramName, paramValue] of Object.entries(inputParams || {})) {
      xmlData += `
    <input>
      <paramName>${paramName}</paramName>
      <paramValue>${paramValue}</paramValue>
    </input>`;
    }

    xmlData += `
  </inputParams>
  <billerResponse>`;
    for (const [key, value] of Object.entries(billerResponse || {})) {
      xmlData += `
    <${key}>${value}</${key}>`;
    }

    xmlData += `
  </billerResponse>
  <additionalInfo>`;
    (additionalInfo || []).forEach(({ infoName, infoValue }) => {
      xmlData += `
    <info>
      <infoName>${infoName}</infoName>
      <infoValue>${infoValue}</infoValue>
    </info>`;
    });

    xmlData += `
  </additionalInfo>
  <paymentDetails>
    <amount>${amount}</amount>
    <currency>${currency}</currency>
    <custConvFee>${custConvFee}</custConvFee>
    <paymentMode>${paymentMode}</paymentMode>
    <quickPay>${quickPay}</quickPay>
    <splitPay>${splitPay}</splitPay>
  </paymentDetails>
  <paymentInfo>`;
    (paymentInfo || []).forEach(({ infoName, infoValue }) => {
      xmlData += `
    <info>
      <infoName>${infoName}</infoName>
      <infoValue>${infoValue}</infoValue>
    </info>`;
    });

    xmlData += `
  </paymentInfo>
</billPaymentRequest>`;

    console.log("XML Request:\n", xmlData);
    const encryptedXML = await encryptData(xmlData);
    console.log("Encrypted XML:", encryptedXML);

    const url = `https://api.billavenue.com/billpay/extBillPayCntrl/billPayRequest/xml?accessCode=${ACCESS_CODE}&requestId=${requestId}&ver=${VERSION}&instituteId=${INSTITUTE_ID}&encRequest=${encryptedXML}`;

    console.log("BillAvenue URL:", url);
    const response = await axios.post(url);
    console.log("Raw Encrypted Response:", response?.data);
    const decryptedResponse = await decryptData(response?.data);
    console.log("Decrypted Response:\n", decryptedResponse);

    const jsonResponse = await parseXmlToJson(decryptedResponse);
    console.log("JSON Response:", JSON.stringify(jsonResponse, null, 2));

    const responseCode =
      jsonResponse?.ExtBillPayResponse?.responseCode || "N/A";

    await BbpsIntegrationModel.create({
      billType: "billPayRequest",
      requestId,
      billerId,
      jsonData: { ExtBillPayResponse: { responseCode } },
    });

    res.status(200).json({
      success: true,
      message: "Valid",
      requestId,
      data: jsonResponse,
    });

  } catch (error) {
    console.error("Bill Pay Request Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Bill Pay Request Failed",
      error: error.message,
    });
  }
};
