const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const Razorpay = require("razorpay");
const moment = require("moment");
// const SettlementMaintainenceModel = require("../../SettlementBalance/Model/SettlementMaintainenceModel")
// const SettlementAuditeModel = require("../../SettlementBalance/Model/SettlementAuditTableModel")
const { v4: uuidv4 } = require("uuid");

const paymentlinkModel = require("../../PaymentLinks/models/paymentlink.model");
const optionsDate = { day: "2-digit", month: "2-digit", year: "numeric" };
const optionsTime = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
};
// const merchantModel = require("../../merchant/models/merchant.model");

// console.log("uniqueLinkId================>",uniqueLinkId)

const VERSION = process.env.CASHFREE_VERSION;
const CLIENT_ID = process.env.CASHFREE_CLIENT_ID;
const CLIENT_SECRET = process.env.CASHFREE_CLIENT_SECRET;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_PAYIN,
});

function generateExpiryDate() {
  const now = new Date();
  now.setHours(now.getHours() + 12);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;

  return formattedDate;
}

exports.createPaymentLink = async (req, res) => {
  const date = new Date();
  const formattedDate = date.toLocaleDateString("en-GB");
  try {
    const uniqueLinkId = uuidv4();
    const {
      link_amount,
      link_currency = "INR",
      link_purpose,
      customer_phone,
      transactionDate,
      transactionTime,
      customerEmail,
      customerName,
    } = req.body;
    const expiryDate = generateExpiryDate();
    console.log("expiryDate===>", expiryDate);
    console.log("req.body in create payment link===>", req.body);
    const MerchantId = req?.merchantId;

    if (!link_amount || !link_purpose || !customer_phone || !MerchantId) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }

    const createdDate = moment().format("dddd, MMMM Do YYYY, h:mm A");

    const headers = {
      "x-api-version": VERSION,
      "X-Client-Id": CLIENT_ID,
      "X-Client-Secret": CLIENT_SECRET,
    };

    const body = {
      link_id: uniqueLinkId,
      link_amount,
      link_currency,
      link_purpose,
      link_expiry_time: expiryDate,
      customer_details: {
        customer_phone,
        MerchantId,
      },
      link_notify: {
        email: false,
        sms: false,
      },
    };

    const response = await axios.post(
      "https://sandbox.cashfree.com/pg/links",
      body,
      { headers }
    );

    const paymentLinkDataToStore = {
      cf_link_id: response.data.cf_link_id,
      enable_invoice: response.data.enable_invoice,
      entity: response.data.entity,
      amount: response.data.link_amount,
      link_amount_paid: response?.data?.link_amount_paid,
      link_auto_reminders: response?.data?.link_auto_reminders,
      link_currency: response?.data?.link_currency,
      link_expiry_time: response?.data?.link_expiry_time,
      link_id: response?.data?.link_id,
      link_partial_payments: response?.data?.link_partial_payments,
      link_purpose: response?.data?.link_purpose,
      link_qrcode: response?.data?.link_qrcode,
      link_status: response?.data?.link_status,
      link_url: response?.data?.link_url,
      terms_and_conditions: response?.data?.terms_and_conditions,
      thank_you_msg: response?.data?.thank_you_msg,
      MerchantId,
      transactionDate: formattedDate,

      transactionTime: new Date().toLocaleTimeString("en-US"),
      customerMobileNumber: customer_phone,
      customerName,
      customerEmail: customerEmail,
    };
    const detailsToSend = {
      MerchantId,
      mobileNumber: merchantDetails?.mobileNumber,
      transactionDate: formattedDate,

      transactionTime: new Date().toLocaleTimeString("en-US"),
      link_id: response?.data?.link_id,
      link_amount_paid: response?.data?.link_amount_paid,
      link_status: response?.data?.link_status,
      customerEmail,
      link_amount: link_amount,
    };
    await SettlementAuditeModel.create(detailsToSend);

    if (response?.data?.link_status === "PAID") {
      const settlementDetails = await SettlementMaintainenceModel.findOne({
        MerchantId,
      }).sort({ createdAt: -1 });
      let newBalance;
      if (!settlementDetails) {
        // No existing settlement, create a new record
        newBalance = Number(response.data.link_amount);
        const detailsToSend = {
          MerchantId,
          mobileNumber: merchantDetails?.mobileNumber,
          transactionDate: formattedDate,

          transactionTime: new Date().toLocaleTimeString("en-US"),
          unSettledAmount: String(newBalance),
          customerEmail,
        };
        await SettlementMaintainenceModel.create(detailsToSend);
      } else {
        // Existing settlement found, update the balance
        const previousBalance = Number(settlementDetails.unSettledAmount);
        newBalance = previousBalance + Number(response.data.link_amount);
        await SettlementMaintainenceModel.findOneAndUpdate(
          { MerchantId },
          { $set: { unSettledAmount: String(newBalance) } }
        );
      }
    } else if (response?.data?.link_status === "ACTIVE") {
      const settlementDetails = await SettlementMaintainenceModel.findOne({
        MerchantId,
      }).sort({ createdAt: -1 });
      let newBalance;
      if (!settlementDetails) {
        // No existing settlement, create a new record
        newBalance = "0";
        const detailsToSend = {
          MerchantId,
          mobileNumber: merchantDetails?.mobileNumber,
          transactionDate: formattedDate,

          transactionTime: new Date().toLocaleTimeString("en-US"),
          unSettledAmount: newBalance,
        };
        await SettlementMaintainenceModel.create(detailsToSend);
      }
    }
    const datatostore = await paymentlinkModel.create(paymentLinkDataToStore);
    console.log("Payment link data stored in the database:", datatostore);
    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Error creating payment link:", error);
    res.status(500).json({ error: error.message });
  }
};

  const genarateReferenceId = () => {
    let now = new Date();
    let time = now.getTime().toString(); // Current timestamp in milliseconds
    let unique = time.slice(-4); // Get last 4 digits of the timestamp for uniqueness
    
    console.log("unique=====>>>", unique);
    
    return `NT${unique}`; 
  };
  

exports.createRazorpayStandardPaymentLink = async (req, res, next) => {
  console.log("calling createRazorpayStandardPaymentLink");
  const formattedTime = new Date().toLocaleTimeString("en-US", optionsTime);
  const formattedDate = new Date().toLocaleDateString("en-GB", optionsDate);
  const {
    amount,
    MerchantId,
    userName,
    mobileNumber,
    actualAmount,
    description,
  } = req.body;

  console.log("Details from front-end Razorpay ===>", req.body);
  const amountInPaise = Math.round(actualAmount * 100);
  console.log("====>>>>amountInPaise", amountInPaise);
  if (!Number.isInteger(amountInPaise) || amountInPaise <= 0) {
    return next({
      statusCode: 400,
      message: "Invalid Input: Amount must be a positive integer.",
    });
  }

  try {
    const options = {
      amount: amount,
      currency: "INR",
      accept_partial: true,
      first_min_partial_amount: 100,
      reference_id: genarateReferenceId(),
      description: description || "Pay the Money",
      customer: {
        name: userName,
        contact: `+91${mobileNumber}`,
        email: 'gaurav.kumar@example.com',
      },
      notify: {
        sms: true,
        email: true,
      },
      reminder_enable: true,
      notes: {
        policy_name: "Jeevan Bima",
      },
      callback_url: "http://localhost:3000/dashboard/payment",
      callback_method: "get",
    };

    console.log("=====>>>>>options", options);

    let LinkEntity = await razorpay.paymentLink.create(options);
    console.log("Payment link created successfully ===>", LinkEntity);

    if (LinkEntity) {
      const newPaymentLink = new paymentlinkModel({
        linkId: LinkEntity.id,
        shortUrl: LinkEntity.short_url,
        amount: LinkEntity.amount,
        amountPaid: LinkEntity.amount_paid,
        currency: LinkEntity.currency,
        status: LinkEntity.status,
        customer: {
          name: LinkEntity.customer.name,
          email: LinkEntity.customer.email,
          contact: LinkEntity.customer.contact,
        },
        description: LinkEntity.description,
        notes: LinkEntity.notes,
        notify: LinkEntity.notify,
        reminderEnabled: LinkEntity.reminder_enable,
        createdAt: LinkEntity.created_at,
        updatedAt: LinkEntity.updated_at,
        expireBy: LinkEntity.expire_by,
        cancelledAt: LinkEntity.cancelled_at,
        expiredAt: LinkEntity.expired_at,
        upiLink: LinkEntity.upi_link,
        whatsappLink: LinkEntity.whatsapp_link,
        referenceId: LinkEntity.reference_id,
        MerchantId,
        createdDate: formattedDate,
        createdTime: formattedTime,
      });

      await newPaymentLink.save(); // Save the payment link to the database
      console.log("Payment link successfully saved to the database!");

      return res
        .status(200)
        .json({
          success: true,
          data: LinkEntity,
          link_url: LinkEntity.short_url,
        });
    }
  } catch (error) {
    console.error("Error in creating payment link ===>", error);

    if (error?.error?.reason === "input_validation_failed") {
      return next({
        statusCode: 400,
        message: "Invalid Input: The amount must be an integer.",
      });
    }
    return next({
      statusCode: 500,
      message: "An error occurred while creating the Razorpay Payment Link.",
    });
  }
};

exports.getPaymentLinkDetails = async (req, res) => {
  const date = new Date();
  const currentYear = date.getFullYear();
  const optionsDate = { day: "2-digit", month: "2-digit", year: "numeric" };
  const optionsTime = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };
  const { link_id } = req.params;
  const authHeader = req.headers.authorization;
  console.log("checking status call");
  if (!authHeader) {
    console.log("Authorization header is required in get payment link by id");
    return res
      .status(400)
      .json({ message: "Authorization header is required" });
  }
  const token = authHeader.split(" ")[1];
  console.log("Token details to save in get link by id===>", token);
  if (!token) {
    console.log("Token is required===>");

    return res.status(400).json({ message: "Token is required" });
  }
  const isValidToken = verify.verify_token(token);
  console.log("isValidToken===>", isValidToken);
  if (!isValidToken) {
    return res.status(401).json({ message: "Invalid token" });
  }
  if (!link_id) {
    console.log("link_id is required===>");
    return res.status(400).json({ message: "link_id is required" });
  }
  const headers = {
    "x-api-version": VERSION,
    "X-Client-Id": CLIENT_ID,
    "X-Client-Secret": CLIENT_SECRET,
  };
  try {
    const response = await axios.get(
      `https://sandbox.cashfree.com/pg/links/${link_id}`,
      { headers }
    );
    console.log("Payment link details retrieved:", response.data);
    return res.status(200).json(response.data);
  } catch (error) {
    console.log("Error fetching payment link details:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.cancelPaymentLink = async (req, res) => {
  const date = new Date();
  const currentYear = date.getFullYear();
  const optionsDate = { day: "2-digit", month: "2-digit", year: "numeric" };
  const optionsTime = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };
  const { link_id } = req.params;

  if (!link_id) {
    return res.status(400).json({ message: "link_id is required" });
  }

  const headers = {
    "x-api-version": VERSION,
    "X-Client-Id": CLIENT_ID,
    "X-Client-Secret": CLIENT_SECRET,
    "x-request-id": req.headers["x-request-id"] || "", // Optional
    "x-idempotency-key": req.headers["x-idempotency-key"] || "", // Optional
  };

  try {
    const url = `https://sandbox.cashfree.com/pg/links/${link_id}/cancel`;
    const response = await axios.post(url, {}, { headers });
    console.log("Payment link canceled successfully:", response.data);
    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Error canceling payment link:", error);

    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.statusText,
        message: error.response.data.message || error.message,
      });
    } else if (error.request) {
      return res.status(500).json({
        error: "No response from server",
        message: "The request was made but no response was received.",
      });
    } else {
      return res.status(500).json({
        error: "Request setup error",
        message: "An error occurred while setting up the request.",
      });
    }
  }
};

exports.getOrderDetails = async (req, res) => {
  const date = new Date();
  const currentYear = date.getFullYear();
  const optionsDate = { day: "2-digit", month: "2-digit", year: "numeric" };
  const optionsTime = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };
  const { link_id } = req.params;
  if (!link_id) {
    return res.status(400).json({ message: "link_id is required" });
  }
  const headers = {
    "x-api-version": "2023-08-01",
    "X-Client-Id": process.env.CLIENT_ID,
    "X-Client-Secret": process.env.CLIENT_SECRET,
  };
  try {
    const url = `https://sandbox.cashfree.com/pg/links/${link_id}/orders`;
    const response = await axios.get(url, { headers });
    console.log(
      "Order details retrieved successfully in payment links:",
      response.data
    );
    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Error retrieving order details:", error);
    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.statusText,
        message: error.response.data.message || error.message,
      });
    } else if (error.request) {
      return res.status(500).json({
        error: "No response from server",
        message: "The request was made but no response was received.",
      });
    } else {
      return res.status(500).json({
        error: "Request setup error",
        message: "An error occurred while setting up the request.",
      });
    }
  }
};

exports.getPaymentLinkTransactions = async (req, res) => {
  const date = new Date();
  const currentYear = date.getFullYear();
  const optionsDate = { day: "2-digit", month: "2-digit", year: "numeric" };
  const optionsTime = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.error("Authorization header is required in verify OTP");
    return res
      .status(400)
      .json({ message: "Authorization header is required" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    console.error("Token is missing in the Authorization header");
    return res.status(400).json({ message: "Token is required" });
  }
  const isValidToken = verify.verify_token(token);
  if (!isValidToken) {
    console.warn("Invalid token received");
    return res.status(401).json({ message: "Invalid token" });
  }
  const merchantDetails = await merchantModel.findOne({ token });
  try {
    const settlementTransactions = await paymentlinkModel.find({
      MerchantId: merchantDetails?.MerchantId,
    });
    if (settlementTransactions.length > 0) {
      return res.status(200).send({ message: "valid", settlementTransactions });
    } else {
      return res
        .status(200)
        .send({ message: "NoTransactionsFound", settlementTransactions });
    }
  } catch (error) {
    console.log(
      "error while fetching settlement audit transactions===>",
      error
    );
  }
};

exports.getTodaysTransactions = async (req, res) => {
  const date = new Date();
  const currentYear = date.getFullYear();
  const optionsDate = { day: "2-digit", month: "2-digit", year: "numeric" };
  const formattedDate = date.toLocaleDateString("en-GB");
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.error("Authorization header is required in verify OTP");
    return res
      .status(400)
      .json({ message: "Authorization header is required" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    console.error("Token is missing in the Authorization header");
    return res.status(400).json({ message: "Token is required" });
  }
  const isValidToken = verify.verify_token(token);
  if (!isValidToken) {
    console.warn("Invalid token received");
    return res.status(401).json({ message: "Invalid token" });
  }
  const merchantDetails = await merchantModel.findOne({ token });
  try {
    const paymentLinktransactions = await paymentlinkModel.find({
      MerchantId: merchantDetails?.MerchantId,
      transactionDate: formattedDate,
      link_status: "PAID",
    });
    if (paymentLinktransactions.length > 0) {
      console.log(
        "todays paymentLinktransactions====>",
        paymentLinktransactions
      );
      const totalAmount = paymentLinktransactions.reduce(
        (acc, transaction) => acc + Number(transaction.link_amount_paid),
        0
      );
      console.log("totalAmount===>", totalAmount);
      return res.status(200).send({ message: "valid", totalAmount });
    } else {
      return res
        .status(200)
        .send({ message: "NoTransactionsFound", paymentLinktransactions });
    }
  } catch (error) {
    console.log(
      "error while fetching settlement audit transactions===>",
      error
    );
  }
};
