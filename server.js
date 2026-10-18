require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { User, Alert } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// DATABASE CONNECTION
// ----------------------------------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log(' Connected to MongoDB successfully!'))
  .catch((err) => console.error(' MongoDB connection error:', err.message));

// Health check
app.get('/', (req, res) => {
  res.send('SATARK API is running');
});

// ----------------------------------------------------
// ROUTE 1: REGISTER OR UPDATE A USER
// ----------------------------------------------------


app.post('/api/users/register', async (req, res) => {
  console.log('Incoming Register Request Body:', req.body);
  try {
    const { name, phone, emergencyContacts } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // Check if user already exists
    let user = await User.findOne({ phone });

    if (user) {
      user.name = name;
      if (emergencyContacts) user.emergencyContacts = emergencyContacts;
      await user.save();
      return res.status(200).json({ message: 'User updated successfully', user });
    }

    // Create new user
    user = new User({ name, phone, emergencyContacts: emergencyContacts || [] });
    await user.save();

    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// ROUTE 2: TRIGGER SOS (LOG INCIDENT & LIVE LOCATION)
// ----------------------------------------------------
app.post('/api/sos/trigger', async (req, res) => {
  try {
    const { userId, latitude, longitude, batteryLevel } = req.body;

    if (!userId || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'userId, latitude, and longitude are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create the active SOS alert
    const newAlert = new Alert({
      userId: user._id,
      userName: user.name,
      userPhone: user.phone,
      latitude,
      longitude,
      batteryLevel: batteryLevel || null
    });

    await newAlert.save();

    console.log(`[ALERT] SOS triggered by ${user.name} at (${latitude}, ${longitude})`);

    // Return alert ID and emergency contacts back to the app
    res.status(201).json({
      message: 'SOS alert recorded',
      alertId: newAlert._id,
      emergencyContacts: user.emergencyContacts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// ROUTE 3: VIEW ACTIVE ALERTS (FOR VERIFICATION)
// ----------------------------------------------------
app.get('/api/sos/active', async (req, res) => {
  try {
    const activeAlerts = await Alert.find({ status: 'ACTIVE' }).sort({ timestamp: -1 });
    res.status(200).json(activeAlerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});