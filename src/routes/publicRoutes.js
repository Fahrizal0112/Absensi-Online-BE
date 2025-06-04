// src/routes/publicRoutes.js
const express = require('express');
const router = express.Router();
const publicAttendanceController = require('../controllers/publicAttendanceController');
const publicUserController = require('../controllers/publicUserController');
const multer = require('multer');
const path = require('path');

// Konfigurasi multer untuk upload foto
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
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

// Routes publik untuk absensi dengan wajah (tanpa login)
router.post('/checkin', upload.single('photo'), publicAttendanceController.checkInWithFace);
router.post('/checkout', upload.single('photo'), publicAttendanceController.checkOutWithFace);

// Route untuk registrasi wajah (tanpa login)
router.post('/register-face', upload.single('photo'), publicUserController.registerFace);

module.exports = router;