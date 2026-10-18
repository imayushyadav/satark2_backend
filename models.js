const mongoose = require('mongoose');

// 1. User Profile & Emergency Contacts
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  emergencyContacts: [
    {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      relation: { type: String, default: 'Contact' }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

// 2. SOS Alert Record (Location + Status)
const alertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String },
  userPhone: { type: String },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  batteryLevel: { type: Number, default: null },
  status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE' },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Alert = mongoose.model('Alert', alertSchema);

module.exports = { User, Alert };