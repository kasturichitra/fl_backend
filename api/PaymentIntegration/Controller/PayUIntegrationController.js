const PayU = require('payu-websdk');
const TransactionModel = require("../../Transactions/Model/TrasnactionModel")
const RazorPayOutController = require("../../Razorpay_payout/controllers/createpayout.controller")
const verify = require("../../../verify.token");
const SettlementMaintainenceModel = require('../../SettlementBalance/Model/SettlementMaintainenceModel');
const SettlementTransactionsModel = require('../../SettlementBalance/Model/SettlementTransactionsModel');
const PayUResponseModel = require("../../PayUResponse/Model/PayResponseModel")
const BBPS_IntegrationModel = require("../../BBPSIntegration/Controller/bbpsintegration.controller");

const axios = require("axios")
const crypto = require('crypto');
const BBPSTrasanctionsModel = require('../../BBPSIntegration/models/BBPSTrasanctionsModel');
const { saveRentalVendorTransactions, saveBBpsSettlementTransactions } = require('../../SettlementBalance/Controller/SettlementTransactionsController');
const { createWalletMaintenance } = require('../../DigitalWallet/Controller/WalletMaintenanceController');
const logger = require('../../Logger/logger');

// const   environment= "PROD"
const environment = process.env.PATY_ENVIRONMENT
// const payuClient = new PayU({
//   key: "Sn5ZsF",
//   salt: "tUfS8JTygs9ZEXJV8kBs0sbpKVxlHc8n",
// },environment);

// const payuClient = new PayU({
//   key: "sppMVS",
//   salt: "VI9awt3C1KhBxU7Vi2oX54bRZlAegCek",

// }, environment);
const payuClient = new PayU({
  key: process.env.PAYU_KEY,
  salt: process.env.PAYU_SALT,

}, environment);

const date = new Date();
const currentYear = date.getFullYear();
const optionsDate = { day: '2-digit', month: '2-digit', year: 'numeric' };
const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
exports.payUIntegration = async (req, res) => {
  const { finalPayableAmount, actualAmount } = req.body;
  const date = new Date();
  const formattedTime = date.toLocaleTimeString('en-US', optionsTime);
  const formattedDate = date.toLocaleDateString('en-GB');
  const detailsToSend = req.body
  console.log("detailsToSend payUIntegration live===>", detailsToSend);
  const txnid = 'TXN' + Date.now();
  const paymentParams = {
    txnid: txnid,
    amount: (detailsToSend?.subService === "Top_Up" || detailsToSend?.subService === "PRO[T+1]") ? actualAmount : finalPayableAmount,
    productinfo: 'Educational Fee',
    firstname: '',
    email: '',
    phone: '',
    surl: "https://ntarbizz.com/Successmsg",
    furl: "https://ntarbizz.com/failmsg",
    udf1: '',
    udf2: '',
    udf3: '',
    udf4: '',
    udf5: '',
    pg: "CC",
    bankcode: detailsToSend?.bankCode,
    ccnum: detailsToSend?.creditCardNumber,
    ccname: detailsToSend?.nameOnCreditCard,
    ccvv: detailsToSend?.creditCardCVV,
    ccexpmon: detailsToSend?.creditCardExpiryMonth,
    ccexpyr: "20" + detailsToSend?.creditCardExpiryYear
  };
  console.log("paymentParams====>", paymentParams)
  const hashString = `${"Sn5ZsF"}|${paymentParams.txnid}|${paymentParams.amount}|${paymentParams.productinfo}|${paymentParams.firstname}|${paymentParams.email}|${paymentParams.udf1}|${paymentParams.udf2}|${paymentParams.udf3}|${paymentParams.udf4}|${paymentParams.udf5}|${"VI9awt3C1KhBxU7Vi2oX54bRZlAegCek"}`;
  const hash = require('crypto').createHash('sha512').update(hashString).digest('hex');
  paymentParams.hash = hash;
  console.log("txnid in pay u in payUIntegration===>", txnid)
  try {
    const paymentHTML = await payuClient.paymentInitiate(paymentParams);
    if (paymentHTML) {
      const newData = {
        ...detailsToSend,
        transactionId: txnid,
        payInStatus: "PROCESSING",
        transactionTime: new Date().toLocaleTimeString('en-US'),
        transactionDate: formattedDate,
      }
      if (
        ["Rental", "Settlements", "Vendors", "Educational", "PayOut_Settlements"].includes(detailsToSend?.serviceName) && detailsToSend?.subService?.toUpperCase() !== "TOP_UP" && detailsToSend?.subService?.toUpperCase() !== "PRO[T+1]") {
        const transactionResponse = await TransactionModel.create(newData);
      } else {
        const bbpsResponse = await BBPSTrasanctionsModel.create(newData);
      }
      return res.json({ paymentURL: paymentHTML, success: true, transactionId: txnid });
    } else {
      return res.status(400).json({ success: false, message: "Unable to extract action URL from payment HTML" });
    }
  } catch (error) {
    console.log(error);
    console.log("error while calling payU intageration===>", error)
    console.log("error while calling payU intageration===>", error?.response?.data)
    return res.status(500).json({ success: false, error: 'Error generating payment URL' });
  }
};
exports.getPayuTransactionDetailsById = async (req, res) => {
  const date = new Date();
  const formattedTime = date.toLocaleTimeString('en-US', optionsTime);
  const formattedDate = date.toLocaleDateString('en-GB');
  const { transactionId } = req.params;
  const detailsToSend = req.body;
  const subService = detailsToSend?.subService?.toUpperCase()
  const authHeader = req.headers.authorization;
  console.log("calling getPayuTransactionDetailsById");
  if (!authHeader) {
    console.log("Authorization header is required");
    return res.status(400).json({ message: 'Authorization header is required' });
  }
  const token = authHeader.split(' ')[1];
  console.log("Token details to save ===>", token);
  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }
  const isValidToken = verify.verify_token(token);
  console.log("isValidToken ===>", isValidToken);
  if (!isValidToken) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  console.log("transactionId from front end for pay u===>", transactionId);
  try {
    const response = await payuClient.verifyPayment(transactionId);
    console.log("response of pay u to get transaction details===>", response);
    const transactionResponse = response?.transaction_details;
    if (!transactionResponse || !transactionResponse[transactionId]) {
      return res.status(404).json({ message: 'Transaction details not found' });
    }
    const transactionDetails = transactionResponse[transactionId];
    console.log("transactionDetails?.status in pay u====>", transactionDetails);
    if (transactionDetails?.status) {
      const transactionStatus = transactionDetails.status?.toUpperCase()
      const payUId = transactionDetails.mihpayid;
      const payUDetails = {
        MerchantId: detailsToSend?.MerchantId,
        transactionDate: formattedDate,
        transactionTime: new Date().toLocaleTimeString('en-US'),
        payUId,
        transactionStatus: transactionDetails.status,
        response: transactionDetails
      }
      const newRecord = await PayUResponseModel.create(payUDetails)
        if (!["Rental", "Settlements", "Vendors", "Educational", "PayOut_Settlements"].includes(detailsToSend?.serviceName)) {
          console.log("calling callBBPSencryptCall in razor pay fetchOrderId")
          await callBBPSencryptCall(detailsToSend, transactionStatus, transactionId, res);
        }
        if (["Rental", "Vendors", "Educational", "PayOut_Settlements"].includes(detailsToSend?.serviceName) || detailsToSend?.subService === "Transfer") {
          console.log("calling callRentalAndVendorPayments")
          const trasnactionResponse = await callRentalAndVendorPayments(detailsToSend, transactionStatus, transactionId, token, res)
        }
        logger.info(`Befor calling topUp in getPayuTransactionDetailsById  ${transactionId}`)
        logger.info(`Befor calling topUp subService in getPayuTransactionDetailsById ${subService}`)
        if (subService === "TOP_UP" || subService === "PRO[T+1]") {
          logger.info(`After calling topUp in razor pay ${transactionId}`)
          detailsToSend.transactionId = transactionId;
          detailsToSend.referenceId = payUId;
          detailsToSend.payInStatus = transactionStatus === "SUCCESS" ? "SUCCESS" : "FAILED";
          const reqToWallet = {
            body: detailsToSend,
            headers: {
              authorization: `Bearer ${token}`,
            },
          };
          logger.info(`After createWalletMaintenance  in getPayuTransactionDetailsById ${transactionId}`)
          await createWalletMaintenance(reqToWallet, res);
        }
      
    } else {
      return res.status(404).json({ message: 'Status not found in transaction details' });
    }
  } catch (error) {
    console.log("error while getting transaction details from payu===>", error);
    console.log("error while getting transaction details from payu===>", error?.response?.data);
    if (!res.headersSent) { // Check if headers are already sent
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }
};

async function callBBPSencryptCall(
  detailsToSave,
  transactionStatus,
  transactionId,
  res
) {
  const formattedTime = new Date().toLocaleTimeString("en-US", optionsTime);
  const date = new Date();
  const formattedDate = date.toLocaleDateString('en-GB');
  const updatedata = {
    billerLogo: detailsToSave?.operator?.billLogo,
    transactionId: transactionId,
    referenceId: transactionId,
    payInStatus: transactionStatus,
    transactionTime: formattedTime,
    transactionDate: formattedDate,
    bbpsRequestId: detailsToSave?.requestId,
    payOutStatus: transactionStatus === "SUCCESS" ? "PROCESSING" : "FAILED",
    transactionType: "Debit",
  }
  const newData = {
    ...detailsToSave,
    billerLogo: detailsToSave?.operator?.billLogo,
    transactionId: transactionId,
    referenceId: transactionId,
    payInStatus: transactionStatus,
    transactionTime: formattedTime,
    transactionDate: formattedDate,
    bbpsRequestId: detailsToSave?.requestId,
    payOutStatus: transactionStatus === "SUCCESS" ? "PROCESSING" : "FAILED",
    transactionType: "Debit",
  };
  const storeBBpsTransactions = await BBPSTrasanctionsModel.findOneAndUpdate({ transactionId }, { $set: { updatedata } });
  if (transactionStatus === "SUCCESS") {
    await callBBPSencryptCall(detailsToSave);
    const bbpsDetailsToSend = {
      ...detailsToSave,
      payInStatus: transactionStatus,
    };
    const req = {
      body: bbpsDetailsToSend,
    };
    const bbpsTransactionResponse = await BBPS_IntegrationModel.encryptSecondCall(req, res);
    if (detailsToSave?.walletSettlementRequired === "YES") {
      const settlementTrasanctions = await saveBBpsSettlementTransactions(req, res)

    }

  } else {
    res.status(201).json(storeBBpsTransactions);

    // return storeBBpsTransactions;
  }
}
async function callRentalAndVendorPayments(
  detailsToSave,
  transactionStatus,
  transactionId,
  token,
  res
) {
  const date = new Date();
  const formattedDate = date.toLocaleDateString('en-GB');
  const razorPayDetails = {
    account_number: detailsToSave?.beneficiaryAccountNumber,
    fund_account_id: detailsToSave?.fundAccountId,
    amount: detailsToSave?.actualAmount,
    currency: "INR",
    mode: detailsToSave?.paymentMode,
    purpose: "refund",
    queue_if_low_balance: true,
    narration: "Acme Corp Fund Transfer",
    notes: {
      notes_key_1: "Tea, Earl Grey, Hot",
      notes_key_2: "Tea, Earl Grey… decaf.",
    },
    actualAmount: Number(detailsToSave?.actualAmount) || 0,
    processingFee: Number(detailsToSave?.processingFee) || 0,
    processingPercentage: Number(detailsToSave?.processingPercentage) || 0,
    chargedAmount: Number(detailsToSave?.chargedAmount) || 0,
    serviceName: detailsToSave?.serviceName,
    subService: detailsToSave?.subService,
    transactionType: detailsToSave?.transactionType,
    payIngateWay: detailsToSave?.payIngateWay,
    payOutGateWay: detailsToSave?.payOutGateWay,
    payInRequired: detailsToSave?.payInRequired,
    payInTransactionId: detailsToSave?.transactionId,
    walletSettlementRequired: detailsToSave?.walletSettlementRequired,
    beneficiaryAccountNumber: detailsToSave?.beneficiaryAccountNumber,
    beneficiaryName: detailsToSave?.beneficiaryName,
    beneficiaryIfscCode: detailsToSave?.ifscCode,
    walletAmount: detailsToSave?.walletAmount,
    walletPreviousBalance: detailsToSave?.walletPreviousBalance,
    walletUpdatedBalance: detailsToSave?.walletUpdatedBalance,
    finalPayableAmount: detailsToSave?.finalPayableAmount,
    payInStatus: detailsToSave?.payInStatus?.toUpperCase(),
    transactionDate: formattedDate,
    transactionTime: new Date().toLocaleTimeString("en-US"),
    MerchantId: detailsToSave?.MerchantId,
    ntarTransactionId: detailsToSave?.ntarTransactionId,
  };
  console.log("calling callRentalAndVendorPayments===>")
  const updateData = {
    payInStatus: transactionStatus,
    payOutStatus: transactionStatus === "SUCCESS" ? "PROCESSING" : "FAILED",
    transactionId,
    transactionTime: new Date().toLocaleTimeString("en-US"),
    transactionDate: formattedDate,
  }
  const transactionsDetails = {
    ...detailsToSave,
    payInStatus: transactionStatus,
    payOutStatus: transactionStatus === "SUCCESS" ? "PROCESSING" : "FAILED",
    transactionId,
    transactionTime: new Date().toLocaleTimeString("en-US"),
    transactionDate: formattedDate,
  };
  const req = {
    body: razorPayDetails,
    headers: {
      authorization: `Bearer ${token}`,
    },
  };
  try {
    const transactionResponse = await TransactionModel.findOneAndUpdate({ transactionId }, { $set: updateData });
    if (transactionStatus === "SUCCESS") {
      console.log("calling CreatePayoutForRazorPay in ")
      const razorPayResponse = await RazorPayOutController.CreatePayoutForRazorPay(req, res);
      if (detailsToSave?.walletSettlementRequired === "YES") {
        const settlementTransactions = await saveRentalVendorTransactions(transactionsDetails);
      }
    }
    console.log("transactionResponse in callRentalAndVendorPayments====>", transactionResponse)
    // return transactionResponse;
    res.status(201).json(transactionResponse);

  } catch (error) {
    console.log("error while saving transactions in razor pay==>", error?.response);
    console.log("error while saving transactions in razor pay==>", error);
  }
}




