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