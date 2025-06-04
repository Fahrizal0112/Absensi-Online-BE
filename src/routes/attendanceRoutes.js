const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { auth, adminAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Konfigurasi multer untuk upload foto
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return cb(new Error('Hanya file gambar yang diizinkan!'));
    }
    cb(null, true);
  }
});

// Routes yang memerlukan autentikasi
router.post('/checkin', auth, upload.single('photo'), attendanceController.checkIn);
router.post('/checkout', auth, upload.single('photo'), attendanceController.checkOut);
router.get('/history', auth, attendanceController.getMyAttendance);

// Routes admin
router.get('/all', adminAuth, attendanceController.getAllAttendance);

module.exports = router; 