const CryptoJS = require("crypto-js");
const RazorPayPayInModel = require("../Model/Razorpay.model");
const Razorpay = require("razorpay");
const logger = require("../../Logger/logger");
const checkingDetails = require("../../../utlis/authorization");
// const BBPSTrasanctionsModel = require("../../BBPSIntegration/models/BBPSTrasanctionsModel");
// const TrasnactionModel = require("../../Transactions/Model/TrasnactionModel");
// const { validateTokenGlobally } = require("../../../Utils/ValidateToken");
// const SchedulerModel = require("../../Schedulers/ScheduleHandler/Models/Scheduler.model");
// require("dotenv").config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_PAYIN,
});
const razorpayOptimzer = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID_OPTIMIZER,
  key_secret: process.env.RAZORPAY_SECRET_PAYIN_OPTIMIZER,
})

console.log("Raorpay key ==--->", process.env.RAZORPAY_KEY_ID);
const secret_key = process.env.RAZORPAY_SECRET_PAYIN;

// console.log("RAZORPAY SECRET KEY => ", secret_key);

exports.getApiKey = async (req, res) => {
  const detailsToSend = req.body
  if (detailsToSend?.subService.toUpperCase() === "PRO[T+1]") {
    console.log("getting key with cash up")
    res.status(200).json({ key: process.env.RAZORPAY_KEY_ID_OPTIMIZER });
  } else {
    res.status(200).json({ key: process.env.RAZORPAY_KEY_ID });

  }
};


exports.createOrder = async (req, res, next) => {
  const date = new Date();
  const formattedDate = date.toLocaleDateString('en-GB');
  const { userid, amount, MerchantId, userName, mobileNumber, chargedAmount, actualAmount, subService, finalPayableAmount} = req.body;
  // const { userid, amount, MerchantId, userName, mobileNumber } = req.body;
  const authHeader = req.headers.authorization;
  const detailsToSave = req.body;
  const validToken = await checkingDetails(authHeader, next)

  logger.info(`Incoming request to create order with details: ${JSON.stringify(detailsToSave)}`);

  // const validToken = await validateTokenGlobally(req, res, next)
  if (validToken) {
    logger.info("Token validation successful createOrder.");
    console.log("validToken in create order===>", validToken)
    let amountInPaise = 1;
    if (subService === "Top_Up" || subService === "PRO[T+1]") {
      amountInPaise = Math.round(actualAmount * 100);
    } else {
      amountInPaise = Math.round(finalPayableAmount * 100);
    }
    if (!Number.isInteger(amountInPaise) || amountInPaise <= 0) {
      logger.error(`Invalid amount: ${amountInPaise} for Order ID: ${userid}`);
      return next({
        statusCode: 400,
        message: "Invalid Input: Amount must be a positive integer.",
      });
    }

    try {
      let receipt = `order_rcptid_${Date.now()}`;
      logger.info(`Generated receipt number in createOrder: ${receipt}`);
      console.log(`Generated receipt number in createOrder: ${receipt}`);

      const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt,
      };

      logger.info("Creating order with Razorpay API...");
      let order;
      console.log(options ,'<=== this is order')
      if (detailsToSave?.subService.toUpperCase() === "PRO[T+1]") {
        console.log("creating order with cash up")

        order = await razorpayOptimzer.orders.create(options);
      } else {
        order = await razorpay.orders.create(options);
      }

      if (order) {
        logger.info(`Order created successfully in createOrder: ${JSON.stringify(order)}`);

        const ordersave = new RazorPayPayInModel({
          order_id: order.id,
          amount: order.amount,
          reciept_no: receipt,
          currency: "INR",
          status: order.status,
          MerchantId,
          userName,
          mobileNumber,
          chargedAmount,
          actualAmount,
          orderCreationResponse: order,
          callback_url: "https://ntarbizz.com/Successmsg",
          detailsToSend: detailsToSave,
          modal: {
            animation: false,
          },
          transactionDate: formattedDate,
          transactionTime: new Date().toLocaleTimeString('en-US'),
        });

        logger.info(`Order data to save in database in createOrder: ${JSON.stringify(ordersave)}`);
        console.log(`Order data to save in database in createOrder: ${JSON.stringify(ordersave)}`);

        await ordersave.save();
        logger.info("Successfully inserted order details into the database in createOrder.");
        console.log("Successfully inserted order details into the database in createOrder.");
      }

      return res.status(200).json({ success: true, order });

    } catch (error) {
      logger.error(`Error occurred while creating order: ${JSON.stringify(error)}`);
      console.log(`Error occurred while creating order: ${JSON.stringify(error)}`);

      if (error?.response?.data) {
        logger.error(`Razorpay error response in createOrder: ${JSON.stringify(error?.response?.data)}`);
        console.log(`Razorpay error response in createOrder: ${JSON.stringify(error?.response?.data)}`);
      }

      if (error?.error?.reason === "input_validation_failed") {
        logger.error("Input validation failed: Invalid amount or other input errors.");
        console.log("Input validation failed: Invalid amount or other input errors.");
        return next({
          statusCode: 400,
          message: "Invalid Input: The amount must be an integer.",
        });
      }

      logger.error("An unexpected error occurred during order creation.");
      console.log("An unexpected error occurred during order creation.");
      return next({
        statusCode: 500,
        message: "An error occurred while creating the order.",
      });
    }
  }
};

exports.verifyPayment = async (req, res, next) => {
  console.log(req.body);
  const date = new Date();
  const formattedDate = date.toLocaleDateString('en-GB');
  logger.info("calling verifyPayment")
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  console.log("token in verify payment===>", token)
  const validToken = validateTokenGlobally(req, res, next)
  if (validToken) {
    try {
      const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, detailsToSave } = req.body;
      console.log("Details - razorpay_order_id:", razorpay_order_id);
      console.log("Details - order_id:", order_id);
      console.log("Details - razorpay_payment_id:", razorpay_payment_id);
      console.log("Details - razorpay_signature:", razorpay_signature);
      console.log("request body is ==> ", req.body);
      console.log("detailsToSave in verify payment===>", detailsToSave)
      logger.info(`detailsToSave in  in razor pay in verifyPayment${JSON.stringify(detailsToSave)}`)
      logger.info(`order id in verify payment in razor pay in verifyPayment ${order_id}  === ${razorpay_order_id}`)
      if (!razorpay_payment_id || !razorpay_signature || !razorpay_order_id) {
        return res.status(400).send({
          success: false,
          message: "Required fields are missing: order_id, razorpay_payment_id, or razorpay_signature."
        });
      }
      let SECRET_KEY = detailsToSave?.subService === "PRO[T+1]" ? process.env.RAZORPAY_SECRET_PAYIN_OPTIMIZER : process.env.RAZORPAY_SECRET_PAYIN
      const generateSignature = CryptoJS.HmacSHA256(order_id + "|" + razorpay_payment_id, SECRET_KEY).toString();
      console.log('generateSignature==>', generateSignature);
      console.log('razorpaysignature==>', razorpay_signature);
      logger.info(`generateSignature in verifyPayment ${JSON.stringify(generateSignature)}`)
      logger.info(`razorpaysignature in verifyPayment ${JSON.stringify(razorpay_signature)}`)
      if (generateSignature === razorpay_signature) {
        logger.info(`signatures are matching in verifypayment ${order_id}`)
        let orderExist = await RazorPayPayInModel.findOne({ order_id });
        if (!orderExist) {
          console.log('Order ID not found in Database');
          return res.status(404).json({ message: "OrderID does not exist in Database" });
        }
        logger.info("order exist in verify payment")
        let updatedOrder = await RazorPayPayInModel.findOneAndUpdate(
          { order_id },
          {
            $set: {
              razorpay_payment_id,
              razorpay_order_id,
              razorpay_signature,
            },
          }, { new: true }
        );
        let payment;
        let orderDetails;
        if (detailsToSave?.subService.toUpperCase() === "PRO[T+1]") {
          console.log("verifypayment  with cash up")

          payment = await razorpayOptimzer.payments.fetch(razorpay_payment_id);
          orderDetails = await razorpayOptimzer.orders.fetch(order_id);
        } else {
          payment = await razorpay.payments.fetch(razorpay_payment_id);
          orderDetails = await razorpay.orders.fetch(order_id);
        }

        console.log("payment fetched =----<?>", payment);
        console.log("orderDetails fetched =----<?>", orderDetails);
        logger.info(`pay ment status in vberify payment==>${JSON.stringify(payment)}`)
        logger.info(`orderDetails ment status in vberify payment==>${JSON.stringify(orderDetails)}`)
        const newData = {
          ...detailsToSave,
          referenceId: razorpay_payment_id,
          transactionId: order_id,
          payInStatus: payment?.status === "captured" ? "SUCCESS" : "FAILED",
          payOutStatus: payment?.status === "captured" ? "PROCESSING" : "FAILED",
        }
        await RazorPayPayInModel.updateOne(
          { order_id },
          {
            orderStatusResponse: payment,
            status: payment?.status,
            detailsToSend: newData
          }
        );
        if (!payment || payment.status !== 'captured') {
          logger.info("This payment is not captured yet or Invalid Payment")
          return res.status(400).json({ message: "This payment is not captured yet or Invalid Payment" });
        }
        if (payment?.status === "captured") {
          const req = {
            body: newData,
          };
          logger.info(`calling fetchPaymentsForOrder ${order_id}`)
          await fetchPaymentsForOrder(req, res, next)

          const scheduler = await SchedulerModel.findOne({
            name: "OnDemanDSettlementScheduler",
            schedulerId: "eefb42d3-46dc-406c-8a57-92ba26fea0ba",
          });
          console.log("scheduler====>>>>>>>>>>>", scheduler);
          const isActive = scheduler?.status === "active" ? true : false;
          if (isActive) {
            await onDemanDSettlement(detailsToSave?.amount, payment);
          }
          // await onDemanDSettlement(detailsToSave?.amount, payment)
        }
        else {
          return res.status(200).send({ message: "valid", response: newData })
        }
        console.log("Start creating settlement =----<?> ");
      }
      else {
        detailsToSave.payInStatus = "FAILED"
        detailsToSave.payOutStatus = "FAILED"
        detailsToSave.transactionDate = formattedDate,
        detailsToSave.transactionTime = new Date().toLocaleTimeString('en-US') || "",
        detailsToSave.transactionId = order_id
        if (
          ["Rental", "Settlements", "Vendors", "Educational", "PayOut_Settlements"].includes(detailsToSave?.serviceName)
        ) {
          logger.info(`Calling callBBPSencryptCall for Order ID: ${detailsToSave?.transactionId}`);
          console.log(`Calling callBBPSencryptCall for Order ID: ${detailsToSave?.transactionId}`);
          transactionsResponse = await TrasnactionModel.create(detailsToSave)
          console.log("transactionsResponse-===>", transactionsResponse)
        } else {
          transactionsResponse = await BBPSTrasanctionsModel.create(detailsToSave)
        }
        // return res.status(400).send({ success: false, message: "Payment verified failed Signature mismatch" });
        return res.status(200).json(
          // success: true,
          // message: "Payment verified failed Signature mismatch",
          transactionsResponse,
        );
      }
    } catch (error) {
      console.error("Error during payment verification:", error);
      console.log("Error in verify payment response ", error?.response)
      console.log("Error in verify payment response data", error?.response?.data)
      logger.error(`error in verifyPayment razor pay ${error}`);
      logger.error(`error in verifyPayment razor pay ${error?.response?.data}`);
      return next({
        message: "InternalServerError",
        statusCode: 500
      });
    }
  };
}

