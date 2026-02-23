const { default: axios } = require("axios");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const { generateTransactionId } = require("../../truthScreen/callTruthScreen");

const InstantPayPaymentCreation = async (req, res, next) => {

  const { creditCardNumber, customerName, paymentMode, amount } = req.body;

  const encryptedCardNumber = encryptData(creditCardNumber)
  const transactionId = generateTransactionId(12)

  const encryptedPayload = {
    payer: {
      bankId: "0",
      bankProfileId: "0",
      name: customerName || "",
      // transferAmount: amount,
      accountNumber: encryptedCardNumber,
      paymentMode: paymentMode,
      cardNumber: "",
      referenceNumber: "",
    },
    payee: {
      name: customerName,
      accountNumber: encryptedCardNumber,
    },
    transferMode: "CREDITCARD",
    transferAmount: amount,
    externalRef: transactionId,
    latitude: "20.5936",
    longitude: "78.9628",
    remarks: "",
    alertEmail: "",
  };
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Ipay-Auth-Code": "1",
    "X-Ipay-Client-Id": process.env.IPAY_CLIENT_ID,
    "X-Ipay-Client-Secret": process.env.IPAY_CLIENT_SECRET,
    "X-Ipay-Endpoint-Ip": process.env.CLIENT_IP,
  };
  const instantApiResponse = await axios.post(
    "https://api.instantpay.in/payments/payout",
    encryptedPayload,
    { headers }
  );

  console.log("instantApiResponse ====>>", instantApiResponse)



}

module.exports = InstantPayPaymentCreation
