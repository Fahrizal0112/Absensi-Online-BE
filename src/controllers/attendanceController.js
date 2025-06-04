const { Attendance, User } = require('../models');
const luxand = require('../utils/luxand');
const fs = require('fs');
const { Op } = require('sequelize');

// Check-in
exports.checkIn = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Foto wajah diperlukan untuk absensi' });
    }

    const user = req.user;
    let verificationSuccess = false;
    let verificationMethod = 'face';

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

    // Verifikasi wajah dengan Luxand
    try {
      // PERUBAHAN: Gunakan recognize dan bandingkan nama
      const recognitionResult = await luxand.recognize(req.file.path);
      
      if (recognitionResult && recognitionResult.length > 0) {
        // Ambil hasil dengan confidence tertinggi
        const bestMatch = recognitionResult.reduce((prev, current) => {
          return (prev.probability > current.probability) ? prev : current;
        });
        
        // Bandingkan nama yang dikenali dengan nama user
        const recognizedName = bestMatch.name;
        verificationSuccess = recognizedName.toLowerCase() === user.name.toLowerCase();
        console.log(`Verifikasi wajah: ${verificationSuccess ? 'Berhasil' : 'Gagal'}`);
        console.log(`Nama dikenali: ${recognizedName}, Nama user: ${user.name}`);
      }
    } catch (error) {
      console.error('Face verification error:', error);
      verificationSuccess = false;
    }

    // Buat catatan absensi dengan latitude dan longitude terpisah
    const attendance = await Attendance.create({
      userId: user.id,
      checkInTime: new Date(),
      status: new Date().getHours() >= 9 ? 'late' : 'present',
      verificationMethod,
      verificationSuccess,
      // Simpan lokasi sebagai latitude dan longitude terpisah
      latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
      longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
      note: req.body.note
    });

    // Hapus file setelah digunakan
    fs.unlinkSync(req.file.path);

    res.status(201).json({
      message: 'Check-in berhasil',
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

// Check-out
exports.checkOut = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Foto wajah diperlukan untuk check-out' });
    }

    const user = req.user;
    let verificationSuccess = false;
    
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

    // Verifikasi wajah dengan Luxand
    if (user.faceId) {
      try {
        const result = await luxand.verifyFace(user.faceId, req.file.path);
        verificationSuccess = result.verified;
      } catch (error) {
        console.error('Face verification error:', error);
        verificationSuccess = false;
      }
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

// Mendapatkan riwayat absensi user
exports.getMyAttendance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = { userId: req.user.id };
    
    if (startDate && endDate) {
      where.checkInTime = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      where.checkInTime = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      where.checkInTime = {
        [Op.lte]: new Date(endDate)
      };
    }
    
    const attendances = await Attendance.findAll({
      where,
      order: [['checkInTime', 'DESC']]
    });
    
    res.status(200).json({ attendances });
  } catch (error) {
    console.error('Error getting attendance history:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil riwayat absensi', error: error.message });
  }
};

// Mendapatkan semua absensi (admin only)
exports.getAllAttendance = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const where = {};
    
    if (userId) {
      where.userId = userId;
    }
    
    if (startDate && endDate) {
      where.checkInTime = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      where.checkInTime = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      where.checkInTime = {
        [Op.lte]: new Date(endDate)
      };
    }
    
    const attendances = await Attendance.findAll({
      where,
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['checkInTime', 'DESC']]
    });
    
    res.status(200).json({ attendances });
  } catch (error) {
    console.error('Error getting all attendance:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data absensi', error: error.message });
  }
}; 
