// const mongoose = require("mongoose");

// const paymentlinks = new mongoose.Schema(
//   {
//     requestId: { type: String },
//     cf_link_id: { type: String },
//     customer_details: { type: Number },
//     enable_invoice: { type: String, default: "INR" },
//     entity: { type: String },
//     amount: { type: String },
//     link_amount_paid: { type: String },
//     link_auto_reminders: { type: String },
//     link_created_at: {
//       type: String,
//     },
//     link_currency: {
//       type: String,
//     },
//     link_expiry_time: {
//       type: String,
//     },
//     link_id: {
//       type: String,
//     },
//     link_partial_payments: {
//       type: String,
//     },
//     link_purpose: {
//       type: String,
//     },
//     link_qrcode: {
//       type: String,
//     },
//     link_status: {
//       type: String,
//     },
//     link_url: {
//       type: String,
//     },
//     terms_and_conditions: {
//       type: String,
//     },
//     thank_you_ms: {
//       type: String,
//     },
//     transactionDate: {
//       type: String,
//     },
//     transactionTime: {
//       type: String,
//     },
//     MerchantId: {
//       type: String,
//     },
//     customerEmail: {
//       type: String,
//     },
//     customerName: {
//       type: String,
//     },
//     order_id: {
//       type: String,
//     },
//     cf_order_id: {
//       type: String,
//     },
//     payment_session_id: {
//       type: String,
//     },
//     customerMobileNumber: {
//       type: String,
//     },
//   },
//   { timestamps: true }
// );

// // Export the model
// module.exports = mongoose.model("paymentlinks", paymentlinks);



const mongoose = require('mongoose');
const { Schema } = mongoose;

const RazorpayPaymentLinkSchema = new Schema({
  MerchantId: { type: String, default: '' },
  linkId: { type: String, required: true, unique: true }, 
  shortUrl: { type: String, required: true },
  amount: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 }, 
  currency: { type: String, default: 'INR' }, 
  status: { type: String, default: 'created' },

  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    contact: { type: String, required: true } 
  },
  
  description: { type: String }, 
  notes: { type: Map, of: String }, 
  
  acceptPartial: { type: Boolean, default: false }, 
  firstMinPartialAmount: { type: Number, default: 0 }, 

  reminderEnabled: { type: Boolean, default: true }, 
  reminders: [
    {
      status: { type: String },
      time: { type: Date },
    },
  ],
  notify: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true }, 
    whatsapp: { type: Boolean, default: false }
  },

  callbackUrl: { type: String },
  callbackMethod: { type: String, default: 'get' }, 

  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true }, 
  expireBy: { type: Number, default: 0 }, 
  cancelledAt: { type: Number, default: 0 }, 
  expiredAt: { type: Number, default: 0 },

  createdDate: { type: String},
  createdTime: { type: String},
  upiLink: { type: Boolean, default: false }, 
  whatsappLink: { type: Boolean, default: false },
  referenceId: { type: String, default: '' },
  payments: { type: Array, default: [] }, 
  
});

module.exports = mongoose.model('RazorpayPaymentLinkModel', RazorpayPaymentLinkSchema);