const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
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

// Routes publik
router.post('/register', userController.register);
router.post('/login', userController.login);

// Routes yang memerlukan autentikasi
router.get('/profile', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.post('/face', auth, upload.single('photo'), userController.addFace);

// Routes admin
router.get('/users', adminAuth, userController.getAllUsers);

module.exports = router; 