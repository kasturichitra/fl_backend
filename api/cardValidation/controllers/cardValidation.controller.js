const Razorpay = require('razorpay');
const { validationResult } = require('express-validator');
require('dotenv').config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, 
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createPaymentOrder = async (req, res, next) => {
  try {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, currency = 'INR', receipt, notes } = req.body;

    // Step 1: Create an order with Razorpay
    const options = {
      amount: amount * 100, // Amount in the smallest unit (paise for INR)
      currency: currency,
      receipt: receipt,
      notes: notes,
    };

    razorpay.orders.create(options, (err, order) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      // Return the order details (including order_id) for further payment processing
      res.status(200).json({
        success: true,
        order_id: order.id,
        currency: order.currency,
        amount: order.amount / 100, // Convert back to the main currency
      });
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Controller to capture payment after successful user authorization
const capturePayment = async (req, res, next) => {
  try {
    const { paymentId, orderId, signature } = req.body;

    // Step 2: Verify the payment signature
    const isSignatureValid = razorpay.orders.verifyPaymentSignature({
      order_id: orderId,
      payment_id: paymentId,
      signature: signature,
    });

    if (!isSignatureValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
    }

    // Step 3: Capture the payment
    razorpay.payments.capture(paymentId, orderId, (err, payment) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.status(200).json({
        success: true,
        message: 'Payment captured successfully.',
        payment: payment,
      });
    });
  } catch (error) {
    console.error('Error capturing payment:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createPaymentOrder,
  capturePayment,
};
