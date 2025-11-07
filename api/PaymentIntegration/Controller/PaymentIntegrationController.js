
const axios = require("axios");
const merchantModel = require("../../merchant/models/merchant.model");
const ServiceTrackingModelModel = require("../../ServiceTrackingModel/models/ServiceTrackingModel.model")
const verify = require("../../../verify.token");
const panverificationModel = require("../../panverification/models/panverification.model");
const { createWalletMaintenance } = require("../../DigitalWallet/Controller/WalletMaintenanceController");
const { CreatePayoutForRazorPay } = require("../../Razorpay_payout/controllers/createpayout.controller");
const { saveRentalVendorTransactions, saveBBpsSettlementTransactions } = require("../../SettlementBalance/Controller/SettlementTransactionsController");
const BBPS_IntegrationModel = require("../../BBPSIntegration/Controller/bbpsintegration.controller");
const TrasnactionModel = require("../../Transactions/Model/TrasnactionModel");
const BBPSTrasanctionsModel = require("../../BBPSIntegration/models/BBPSTrasanctionsModel");
const CashFreePayIntransactionsModel = require("../../CashFreePayIntransactions/CashFreePayIntransactionsModel");
const { Cashfree } = require("cashfree-pg");
const XClientId = process.env.CASHFREE_CLIENT_ID;
const XClientSecret = process.env.CASHFREE_CLIENT_SECRET;
const CASHFREE_API_URL = process.env.CASHFREE_URL;
const ENVIRONMENT = process.env.CASHFREE_ENVIRONMENT;
Cashfree.XClientId = XClientId;
Cashfree.XClientSecret = XClientSecret;
Cashfree.XEnvironment = ENVIRONMENT;
const CASHFREE_VERSION = process.env.CASHFREE_VERSION
const generateTransactionId = require("../../../Utils/generateTransactionId");



// exports.cashFreePayment = async (req, res) => {
//   const { orderAmount, details } = req.body;
//   const CASHFREE_API_URL = process.env.CASHFREE_URL;
//   const date = new Date();
//   const optionsTime = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true };
//   const formattedTime = date.toLocaleTimeString("en-US", optionsTime);
//   const formattedDate = date.toLocaleDateString('en-GB');
//   const request = {
//     order_amount: orderAmount,
//     order_currency: "INR",
//     customer_details: {
//       customer_id: "node_sdk_test",
//       customer_email: "example@gmail.com",
//       customer_phone: "9999999999",
//     },
//     order_meta: {
//       return_url: "https://ntarbizz.com/Successmsg"
//     }
//   };
//   try {
//     const response = await axios.post(
//       CASHFREE_API_URL,
//       request,
//       {
//         headers: {
//           'Content-Type': 'application/json',
//           'x-client-id': process.env.CASHFREE_CLIENT_ID,
//           'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
//           'x-api-version': '2023-08-01',
//         }
//       }
//     );
//     console.log("Response from CashFree API:", response.data);

//     // const newDataToSave = {
//     //   MerchantId: details?.MerchantId,
//     //   mobileNumber: details?.mobileNumber,
//     //   transactionId: response?.data?.order_id,
//     //   amount: orderAmount,
//     //   detailsToSend: details,
//     //   transactionDate: formattedDate,
//     //   transactionTime: formattedTime,
//     //   transactionStatus: "PROCESSING"
//     // };
//     // const addRecord = await CashFreePayIntransactionsModel.create(newDataToSave);
//     res.status(200).json({
//       paymentDetails: response?.data,
//       orderId: response?.data?.order_id,
//       paymentSessionId: response?.data?.payment_session_id,
//       environment: ENVIRONMENT,
//     });

//   } catch (error) {
//     // Error handling
//     if (error.response) {
//       console.error('Error response data:', error.response.data);
//       console.error('Error response status:', error.response.status);
//       res.status(500).send(error.response.data);
//     } else if (error.request) {
//       console.error('Error request data:', error.request);
//       res.status(500).send("No response received from CashFree API.");
//     } else {
//       console.error('Error message:', error.message);
//       res.status(500).send(error.message);
//     }
//   }
// };

exports.cashFreePayment = async (req, res) => {
  const { orderAmount, details } = req.body;
  const date = new Date();
  const generateUniqueId = await generateTransactionId()
  const orderId = `cashFree_${generateUniqueId}`
  console.log("ENVIRONMENT---->", ENVIRONMENT)
  const optionsTime = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true };
  const formattedTime = date.toLocaleTimeString("en-US", optionsTime);
  const formattedDate = date.toLocaleDateString('en-GB');
  const request = {
    order_amount: orderAmount,
    order_currency: "INR",
    order_id: orderId,
    customer_details: {
      customer_id: "node_sdk_test",
      // customer_email: "example@gmail.com",
      customer_phone: "9999999999",
    },
    order_meta: {
      return_url: "https://ntarbizz.com/Successmsg"
    }
  };
  try {
    console.log("request send to cashfree to create order===>", request)
    Cashfree.XEnvironment = Cashfree.Environment.PRODUCTION;
    // Cashfree.XEnvironment = Cashfree.Environment.SANDBOX;
    const response = await Cashfree.PGCreateOrder("2023-08-01", request)
    console.log('Order created successfully:', response);
    console.log("response after creating orderId===>", response?.data)
    const newDataToSave = {
      MerchantId: details?.MerchantId,
      mobileNumber: details?.mobileNumber,
      transactionId: response?.data?.order_id,
      amount: orderAmount,
      detailsToSend: details,
      transactionDate: formattedDate,
      transactionTime: formattedTime,
      transactionStatus: "PROCESSING"
    };
    const addRecord = await CashFreePayIntransactionsModel.create(newDataToSave);
    res.status(200).json({
      paymentDetails: response?.data,
      orderId: response?.data?.order_id,
      paymentSessionId: response?.data?.payment_session_id,
      environment: "PRODUCTION",
    });

  } catch (error) {
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      res.status(500).send(error.response.data);
    } else if (error.request) {
      console.error('Error request data:', error.request);
      res.status(500).send("No response received from CashFree API.");
    } else {
      console.error('Error message:', error.message);
      res.status(500).send(error.message);
    }
  }
}



// exports.cashFreePayment = async (req, res) => {
//   const { orderAmount, details } = req.body;
//   const CASHFREE_API_URL = `${cashFreeUrl}`;
//   const date = new Date();
//   const optionsTime = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, };
//   const formattedTime = new Date().toLocaleTimeString("en-US", optionsTime);
//   const formattedDate = date.toLocaleDateString('en-GB');
//   // const CASHFREE_API_URL = 'https://sandbox.cashfree.com/pg/orders';
//   console.log("cash free url1===>", CASHFREE_API_URL)
//   console.log("cash free url2===>", "https://sandbox.cashfree.com/pg/orders")
//   console.log("cash free url3===>", process.env.CASHFREE_URL)
//   console.log("orderAmount in cash free pxaymnets===>", orderAmount)
//   console.log("client key===>", XClientId)
//   console.log("client salt===>", XClientSecret)
//   const request = {
//     order_amount: orderAmount,
//     order_currency: "INR",
//     customer_details: {
//       customer_id: "node_sdk_test",
//       customer_name: "",
//       customer_email: "example@gmail.com",
//       customer_phone: "9999999999"
//     },
//     order_meta: {
//       return_url: "https://ntarbizz.com/Successmsg"
//     },
//     order_note: ""
//   };
//   try {
//     const response = await axios.post(
//       `${CASHFREE_API_URL}`,
//       request,
//       {
//         headers: {
//           'Content-Type': 'application/json',
//           'x-client-id': XClientId,
//           'x-client-secret': XClientSecret,
//           'x-api-version': '2023-08-01',
//         }
//       }
//     );
//     console.log("response while creating order in cashfree===>", response.data)
//     const orderId = response.data.order_id;
//     const createOrderResponse = response?.data
//     const detailsResponse = await axios.get(
//       // `https://sandbox.cashfree.com/pg/orders/${orderId}`,
//       `${CASHFREE_API_URL}/${orderId}`,
//       {
//         headers: {
//           'Content-Type': 'application/json',
//           'x-client-id': XClientId,
//           'x-client-secret': XClientSecret,
//           'x-api-version': '2023-08-01',
//         }
//       }
//     );
//     console.log("detailsResponse.payment_session_id===>", detailsResponse.data.payment_session_id)
//     console.log("details?.creditCardNumber", details?.creditCardNumber)
//     console.log("details?.nameOnCreditCard", details?.nameOnCreditCard)
//     console.log("details?.creditCardExpiryMonth", details?.creditCardExpiryMonth)
//     console.log("details?.creditCardExpiryYear", details?.creditCardExpiryYear)
//     console.log("details?.creditCardCVV", details?.creditCardCVV)
//     // const paymentDetails = await axios.post(`https://sandbox.cashfree.com/pg/orders/sessions`, {
//     const paymentDetails = await axios.post(`${cashFreeUrl}/sessions`, {
//       payment_session_id: detailsResponse.data.payment_session_id,
//       payment_method: {
//         // netbanking: {
//         //   channel: 'link',
//         //   netbanking_bank_code: 3022,
//         //   netbanking_bank_name: 'icici'
//         // },
//         // "card": {
//         //   "channel": "link",
//         //   "card_number": details?.creditCardNumber,
//         //   "card_holder_name": details?.nameOnCreditCard,
//         //   "card_expiry_mm": details?.creditCardExpiryMonth,
//         //   "card_expiry_yy": details?.creditCardExpiryYear,
//         //   "card_cvv": details?.creditCardCVV
//         // }
//         card: {
//           channel: 'link',
//           card_number: '4111111111111111',
//           card_holder_name: 'Tushar Gupta',
//           card_expiry_mm: '06',
//           card_expiry_yy: '27',
//           card_cvv: '900'
//         }
//       }


//     })
//     console.log("paymentDetails in cashfree===>", paymentDetails?.data)
//     console.log("paymentDetails===>", paymentDetails.data.cf_payment_id)
//     const payOrderResponse = paymentDetails?.data
//     const paymentId = paymentDetails?.data?.cf_payment_id
//     const newDataToSave = {
//       MerchantId: details?.MerchantId,
//       mobileNumber: details?.mobileNumber,
//       transactionId: orderId,
//       referenceId: paymentId,
//       amount: orderAmount,
//       createOrderResponse: createOrderResponse,
//       payOrderResponse: payOrderResponse,
//       detailsToSend: details,
//       transactionDate: formattedDate,
//       transactionTime: formattedTime,
//       transactionStatus: "PROCESSING"
//     }
//     const addRecord = await CashFreePayIntransactionsModel.create(newDataToSave)
//     res.status(200).json({
//       paymentDetails: paymentDetails?.data,
//       orderId: orderId,
//       paymentId: paymentId

//     });
//     // console.log("paymentDetails===>", paymentDetails);
//     // res.json(paymentDetails.data);
//   } catch (error) {
//     if (error.response) {
//       console.error('Response data in error:', error.response.data);
//       console.error('Response status:', error.response.status);
//       console.error('Response headers:', error.response.headers);
//     } else if (error.request) {
//       console.error('Request data:', error.request);
//     } else {
//       console.error('Error message:', error.message);
//     }
//     res.status(500).send(error.response ? error.response.data : error.message);
//   }
// }


exports.getPaymentStatus = async (req, res) => {
  const { orderId, paymentId } = req.params;
  const detailsToSend = req.body
  let subService = detailsToSend?.subService?.toUpperCase()
  console.log("order id and payment id oin payment status===>", req.params)
  try {
    // const response = await axios.get(`https://sandbox.cashfree.com/pg/orders/${orderId}/payments/${paymentId}`, {
    // const response = await axios.get(`${cashFreeUrl}/${orderId}/payments/${paymentId}`, {
    //   headers: {
    //     'accept': 'application/json',
    //     'x-api-version': '2023-08-01',
    //     'x-client-id': XClientId,
    //     'x-client-secret': XClientSecret,
    //   },
    // });
    const response = await Cashfree.PGOrderFetchPayments(CASHFREE_VERSION, orderId)
    console.log("Payment Status:", response.data);
    let transactionStatus = response?.data[0]?.payment_status;
    let transactionId = orderId;
    detailsToSend.transactionId = orderId;
    detailsToSend.referenceId = paymentId;
    detailsToSend.payInStatus = response?.data[0]?.payment_status.toUpperCase();
    if (
      !["Rental", "Settlements", "Vendors", "Educational", "PayOut_Settlements"].includes(detailsToSend?.serviceName)
    ) {
      console.log(`Calling callBBPSencryptCall for Order ID: ${detailsToSend?.transactionId}`);
      await callBBPSencryptCall(detailsToSend, transactionStatus, transactionId, res);
    }
    if (
      ["Rental", "Vendors", "Educational", "PayOut_Settlements"].includes(detailsToSend?.serviceName) ||
      detailsToSend?.subService === "Transfer"
    ) {
      console.log(`Calling callRentalAndVendorPayments for Order ID: ${detailsToSend?.transactionId}`);
      const transactionResponse = await callRentalAndVendorPayments(detailsToSend, transactionStatus, transactionId, res);
    }
    if (subService === "TOP_UP" || subService === "PRO[T+1]") {
      console.log(`Processing topUp or PRO[T+1] for Order ID: ${detailsToSend?.transactionId}`);
      const reqToWallet = {
        body: detailsToSend,
      };
      await createWalletMaintenance(reqToWallet, res);

    }
    const updateCashFreeTrasnaction = await CashFreePayIntransactionsModel.findOneAndUpdate({ transactionId: orderId }, { transactionStatus: response?.data[0]?.payment_status })
    // res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({
      message: "Error fetching payment status",
      error: error.message
    });
  }
};
exports.getQrCodeGeneration = async (req, res) => {
  const headers = {
    "X-Client-Id": process.env.CASHFREE_CLIENT_ID,
    "X-Client-Secret": process.env.CASHFREE_CLIENT_SECRET,
    "Content-Type": "application/json"  // Ensure this header is set correctly
  };

  try {
    // Make the POST request to get the authorization token
    const response = await axios.post("https://cac-gamma.cashfree.com/cac/v1/authorize", {}, { headers });
    console.log("response:", response.data);

    // Extract the bearer token from the response
    const authToken = response.data.token; // Ensure response structure matches this
    console.log("authToken:", authToken);

    // Return the token or save it for future use
    return res.json({ token: authToken });
  } catch (error) {
    console.error("Error while obtaining authorization token:", error.message);

    // Return error details in the response
    return res.status(error.response ? error.response.status : 500).json({
      error: error.message,
      ...(error.response ? { details: error.response.data } : {})
    });
  }
};
exports.panVerificationBeneficiary = async (req, res, next) => {
  const { panNumber } = req.body;
  console.log("pan number from frontend===>", panNumber);
  const capitalPanNumber = panNumber.toUpperCase()

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log("Authorization header is required");
    return res.status(400).json({ message: 'Authorization header is required' });
  }
  const token = authHeader.split(' ')[1];
  console.log("Token details to save===>", token);
  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }
  const isValidToken = verify.verify_token(token);
  console.log("isValidToken===>", isValidToken);
  if (!isValidToken) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  if (!panNumber) {
    return res.status(400).json({ message: 'PAN number is required' });
  }

  try {
    const merchant = await merchantModel.findOne({ token });
    if (!merchant) {
      return res.status(404).json({ message: 'User not found' });
    }
    const MerchantId = merchant.MerchantId;
    if (!MerchantId) {
      return res.status(400).json({ message: 'merchant ID not found for the user' });
    }
    console.log("capitalPanNumber===>", capitalPanNumber)
    const existingPanNumber = await panverificationModel.findOne({ panNumber: capitalPanNumber });
    console.log("existingPanNumber===>", existingPanNumber)
    if (existingPanNumber) {
      const username = existingPanNumber?.userName
      console.log("existingPanNumber pan number===>", username)
      const response = {
        beneficiaryName: username,
        message: "Valid"
      }
      return res.json({ response });
    }
    const activeService = await ServiceTrackingModelModel.findOne({ serviceFor: "Pan", serviceStatus: "Active" });
    console.log("activeService====>", activeService);
    if (activeService) {
      if (activeService?.serviceName === "Invincible") {
        const response = await invinciblePanVerification(capitalPanNumber, token, MerchantId);
        return res.json({ response });
      }
      else if (activeService?.serviceName === "Zoop") {
        const response = await zoopPanVerification(capitalPanNumber, token, MerchantId);
        console.log("response from zoop............", response);
        const username = response?.username;
        return res.json({ response });
      }
    }
    else {
      console.log("No active service available")
      return res.status(404).json({ message: "No Active Service Available" })
    }

  } catch (error) {
    console.log('Error in PAN verification panVerificationBeneficiary:', error);
    return next(error);
  };
}
async function invinciblePanVerification(panNumber, token, MerchantId, next) {
  let panHolderName;
  try {
    const clientId = process.env.INVINCIBLE_CLIENT_ID;
    const secretKey = process.env.INVINCIBLE_SECRET_KEY;
    const url = 'https://api.invincibleocean.com/invincible/panPlus';
    const headers = {
      'clientId': clientId,
      'secretKey': secretKey,
      'Content-Type': 'application/json'
    };
    const data = { panNumber };
    const response = await axios.post(url, data, { headers });
    console.log('API response:', response.data);
    if (response.data.code === 404) {
      console.log(" pan data not found")
      return { message: "NoDataFound" }
    }
    else if (response.data.code === 402) {
      console.log("NoBalance")
      return { message: "NoBalance" }
    }
    const obj = response.data;
    const result = obj.result || {};
    const firstName = result.FIRST_NAME || '';
    const middleName = result.MIDDLE_NAME || '';
    const lastName = result.LAST_NAME || '';
    // if (!firstName && !middleName && !lastName) {
    //   throw new Error('Invalid PAN verification');
    // }
    const username = [firstName, middleName, lastName].filter(Boolean).join(' ');

    const panData = {
      panNumber,
      response: obj,
      token,
      MerchantId,
      userName: username
    };
    const newpanVerification = await panverificationModel.create(panData);

    // const pandetails = await panverificationModel.findOne({ MerchantId });
    // if (pandetails) {
    //   const updatepanVerification = await panverificationModel.findOneAndUpdate({ MerchantId }, { $set: { panNumber, response: obj, token } });
    // }
    // if (!pandetails) {
    //   const newpanVerification = await panverificationModel.create(panData);
    // }

    return { beneficiaryName: username, message: "Valid" };
  } catch (error) {
    console.log('Error performing PAN verification in invincible:', error?.message);
    // console.log("error.response in pan verification====>", error.response)
    // if (error.response) {
    //   throw new Error(error.response.data);
    // } else if (error.request) {
    //   throw new Error('No response received from server');
    // } else {
    //   throw new Error(error.message);
    // }
  }
}
async function zoopPanVerification(panNumber, token, MerchantId) {
  try {
    const options = {
      method: 'POST',
      url: 'https://live.zoop.one/api/v1/in/identity/pan/lite',
      headers: {
        'app-id': process.env.ZOOP_APP_ID,
        'api-key': process.env.ZOOP_API_KEY,
        'Content-Type': 'application/json',
        'org-id': process.env.ZOOP_ORG_ID
      },
      data: {
        mode: 'sync',
        data: {
          customer_pan_number: panNumber,
          consent: 'Y',
          consent_text: 'Iconsenttothisinformationbeingsharedwithzoop.one'
        }
      }
    };

    const response = await axios(options);

    // Parse the response body
    const obj = response.data;
    console.log(obj);
    if (obj.response_code === "101") {
      return { message: "NoDataFound" }

    }
    const pancardNumber = obj.result.pan_number;
    const username = obj.result.user_full_name;

    // Save the PAN verification data to your MongoDB collection
    const panVerificationData = {
      panNumber,
      response: obj,
      token,
      MerchantId,
      userName: username
    };

    await panverificationModel.create(panVerificationData);
    // Return the PAN verification response
    return { beneficiaryName: username, message: "Valid" };
  } catch (error) {
    let errorMessage = 'Failed to perform PAN verification';
    let statusCode = 400;

    if (error.response) {
      const { response_code, response_message } = error.response.data;
      errorMessage = `PAN verification failed,${response_message} (Code: ${response_code})`;
      statusCode = 400; // or set according to response_code if necessary
      throw { message: errorMessage, statusCode }; // Throwing an object
    } else if (error.request) {
      throw { message: 'No response received from the PAN verification service.', statusCode };
    } else {
      throw { message: 'Error during PAN verification: ' + error.message, statusCode };
    }
  }
}
async function callBBPSencryptCall(
  detailsToSave,
  transactionStatus,
  transactionId,
  res
) {
  const optionsTime = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, };

  const formattedTime = new Date().toLocaleTimeString("en-US", optionsTime);
  const date = new Date();
  const formattedDate = date.toLocaleDateString('en-GB');
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
  const storeBBpsTransactions = await BBPSTrasanctionsModel.create(newData);
  if (transactionStatus === "SUCCESS") {
    // await callBBPSencryptCall(detailsToSave);
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
  }
}
async function callRentalAndVendorPayments(
  detailsToSave,
  transactionStatus,
  transactionId,
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
  console.log("calling callRentalAndVendorPayments===>", transactionStatus)
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
  };
  try {
    const transactionResponse = await TrasnactionModel.create(
      transactionsDetails
    );
    if (transactionStatus === "SUCCESS") {
      console.log("calling CreatePayoutForRazorPay in ")
      const razorPayResponse = await CreatePayoutForRazorPay(req, res);
      if (detailsToSave?.walletSettlementRequired === "YES") {
        const settlementTransactions = await saveRentalVendorTransactions(transactionsDetails);
      }
    } else {
      res.status(201).json(transactionResponse);
    }
    console.log("transactionResponse in callRentalAndVendorPayments====>", transactionResponse)
    // return transactionResponse;
    // 

  } catch (error) {
    console.log("error while saving transactions==>", error?.response);
    console.log("error while saving transactions==>", error);
  }
}

