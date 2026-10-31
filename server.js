require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
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


// REGISTER ROUTE
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, fullName, name, phone, password, bloodGroup, medicalNotes } = req.body;
        const displayName = fullName || name;

        // 1. Validation checks
        if (!username || !password || !displayName || !phone) {
            return res.status(400).json({
                success: false,
                message: 'All fields (Username, Password, Name, Phone) are required.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        const normalizedUsername = username.trim().toLowerCase();

        // 2. Check if username already exists in MongoDB
        const existingUser = await User.findOne({ username: normalizedUsername });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'This username is already taken. Please choose a different one.'
            });
        }

        // 3. Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Save new user
        const newUser = new User({
            username: normalizedUsername,
            password: hashedPassword,
            name: displayName.trim(),
            phone: phone.trim(),
            bloodGroup: bloodGroup || '',
            medicalNotes: medicalNotes || ''
        });

        const savedUser = await newUser.save();

        return res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            user: {
                id: savedUser._id,
                username: savedUser.username,
                name: savedUser.name,
                phone: savedUser.phone
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'This username or phone number is already registered.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server error during registration. Please try again later.'
        });
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

// LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please enter both username and password.'
            });
        }

        const normalizedUsername = username.trim().toLowerCase();

        // 1. Check if user exists
        const user = await User.findOne({ username: normalizedUsername });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found. Please check your username or sign up.'
            });
        }

        // 2. Compare hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Incorrect password. Please verify and try again.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                phone: user.phone
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during login. Please try again later.'
        });
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