// src/controllers/publicAttendanceController.js
const { User, Attendance } = require('../models');
const luxand = require('../utils/luxand');
const fs = require('fs');
const { Op } = require('sequelize');

// Check-in tanpa login (hanya dengan pengenalan wajah)
exports.checkInWithFace = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Foto wajah diperlukan untuk absensi' });
    }

    let verificationSuccess = false;
    let verificationMethod = 'face';
    let user = null;

    // Coba kenali wajah dengan Luxand
    try {
      const recognitionResult = await luxand.recognize(req.file.path);
      console.log('Hasil pengenalan wajah:', JSON.stringify(recognitionResult));
      
      if (recognitionResult && recognitionResult.length > 0) {
        // Ambil hasil dengan confidence tertinggi
        const bestMatch = recognitionResult.reduce((prev, current) => {
          return (prev.probability > current.probability) ? prev : current;
        });
        
        // PERUBAHAN: Gunakan nama untuk mencari user
        const recognizedName = bestMatch.name;
        console.log('Mencari user dengan nama:', recognizedName);
        
        // Cari user dengan nama yang sama (case-insensitive)
        user = await User.findOne({
          where: {
            name: {
              [Op.iLike]: recognizedName  // PostgreSQL case-insensitive match
            }
          }
        });
        
        // Log hasil pencarian
        console.log('User ditemukan:', user ? 'Ya' : 'Tidak');
        
        if (user) {
          verificationSuccess = true;
        }
      }
    } catch (error) {
      console.error('Face recognition error:', error);
      verificationSuccess = false;
    }

    // Tambahkan log untuk debugging
    console.log('User setelah pengenalan wajah:', user);

    if (!user) {
      // Hapus file setelah digunakan
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Wajah tidak dikenali. Silakan daftar terlebih dahulu.' });
    }

    // Cek apakah sudah absen hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingAttendance = await Attendance.findOne({
      where: {
        userId: user.id,
        checkInTime: {
          [Op.gte]: today
        }
      }
    });

    if (existingAttendance) {
      // Hapus file setelah digunakan
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Anda sudah melakukan check-in hari ini' });
    }

    // Buat catatan absensi
    const attendance = await Attendance.create({
      userId: user.id,
      checkInTime: new Date(),
      status: new Date().getHours() >= 9 ? 'late' : 'present',
      verificationMethod,
      verificationSuccess,
      latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
      longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
      note: req.body.note
    });

    // Hapus file setelah digunakan
    fs.unlinkSync(req.file.path);

    res.status(201).json({
      message: 'Check-in berhasil',
      user: {
        name: user.name,
        email: user.email
      },
      attendance: {
        id: attendance.id,
        checkInTime: attendance.checkInTime,
        status: attendance.status,
        verificationSuccess: attendance.verificationSuccess
      }
    });
  } catch (error) {
    console.error('Error checking in:', error);
    
    // Hapus file jika terjadi error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ message: 'Terjadi kesalahan saat check-in', error: error.message });
  }
};

// Check-out tanpa login (hanya dengan pengenalan wajah)
exports.checkOutWithFace = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Foto wajah diperlukan untuk check-out' });
    }

    let verificationSuccess = false;
    let user = null;

    // Coba kenali wajah dengan Luxand
    try {
      const recognitionResult = await luxand.recognize(req.file.path);
      
      if (recognitionResult && recognitionResult.length > 0) {
        // Ambil hasil dengan confidence tertinggi
        const bestMatch = recognitionResult.reduce((prev, current) => { 
          return (prev.probability > current.probability) ? prev : current;
        });
        
        // PERUBAHAN: Gunakan nama untuk mencari user
        const recognizedName = bestMatch.name;
        console.log('Mencari user dengan nama:', recognizedName);
        
        // Cari user dengan nama yang sama (case-insensitive)
        user = await User.findOne({
          where: {
            name: {
              [Op.iLike]: recognizedName  // PostgreSQL case-insensitive match
            }
          }
        });
        
        if (user) {
          verificationSuccess = true;
        }
      }
    } catch (error) {
      console.error('Face recognition error:', error);
      verificationSuccess = false;
    }

    if (!user) {
      // Hapus file setelah digunakan
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Wajah tidak dikenali. Silakan daftar terlebih dahulu.' });
    }
    
    // Cari absensi hari ini yang belum checkout
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const attendance = await Attendance.findOne({
      where: {
        userId: user.id,
        checkInTime: {
          [Op.gte]: today
        },
        checkOutTime: null
      }
    });

    if (!attendance) {
      // Hapus file setelah digunakan
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Tidak ditemukan check-in hari ini atau Anda sudah melakukan check-out' });
    }

    // Update catatan absensi
    await attendance.update({
      checkOutTime: new Date(),
      verificationSuccess,
      note: req.body.note ? (attendance.note ? `${attendance.note}; ${req.body.note}` : req.body.note) : attendance.note
    });

    // Hapus file setelah digunakan
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      message: 'Check-out berhasil',
      user: {
        name: user.name,
        email: user.email
      },
      attendance: {
        id: attendance.id,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        status: attendance.status,
        verificationSuccess: attendance.verificationSuccess
      }
    });
  } catch (error) {
    console.error('Error checking out:', error);
    
    // Hapus file jika terjadi error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ message: 'Terjadi kesalahan saat check-out', error: error.message });
  }
};
