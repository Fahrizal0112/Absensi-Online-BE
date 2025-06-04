const { User } = require('../models');
const jwt = require('jsonwebtoken');
const luxand = require('../utils/luxand');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Membuat token JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// Register user baru
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Cek apakah email sudah terdaftar
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email sudah terdaftar' });
    }

    // Buat user baru
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user'
    });

    // Buat person di Luxand
    const person = await luxand.createPerson(name);
    
    // Update user dengan faceId
    await user.update({ faceId: person.uuid });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      message: 'User berhasil dibuat',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        faceId: user.faceId
      },
      token
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mendaftarkan user', error: error.message });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Cari user berdasarkan email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    // Validasi password
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    // Generate token
    const token = generateToken(user);

    res.status(200).json({
      message: 'Login berhasil',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat login', error: error.message });
  }
};

// Mendapatkan profil user
exports.getProfile = async (req, res) => {
  try {
    res.status(200).json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        faceId: req.user.faceId,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt
      }
    });
  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil profil', error: error.message });
  }
};

// Update profil user
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (email) updates.email = email;

    await req.user.update(updates);

    res.status(200).json({
      message: 'Profil berhasil diperbarui',
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui profil', error: error.message });
  }
};

// Menambahkan wajah ke user
exports.addFace = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Foto wajah diperlukan' });
    }

    const user = req.user;
    let personId = user.faceId;
    
    // Jika user belum memiliki faceId, buat person baru dengan foto di Luxand
    if (!personId) {
      console.log('Membuat person baru dengan foto di Luxand untuk user:', user.name);
      try {
        // PENTING: Gunakan nama user yang tepat sama dengan yang tersimpan di database
        const person = await luxand.createPersonWithFace(user.name, req.file.path);
        console.log('Respons createPersonWithFace:', JSON.stringify(person));
        
        if (!person || !person.uuid) {
          throw new Error('Respons dari Luxand tidak mengandung UUID');
        }
        
        personId = person.uuid;
        console.log('Person ID baru:', personId);
        
        // Update user dengan faceId baru
        await user.update({ faceId: personId });
        
        // Refresh user data dari database
        const updatedUser = await User.findByPk(user.id);
        console.log('User diupdate dengan faceId:', updatedUser.faceId);
        
        // Hapus file setelah digunakan
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(200).json({
          message: 'Wajah berhasil ditambahkan',
          result: person
        });
      } catch (createError) {
        console.error('Error saat membuat person dengan foto:', createError);
        // Hapus file jika terjadi error
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ 
          message: 'Terjadi kesalahan saat membuat profil wajah', 
          error: createError.message 
        });
      }
    } else {
      // Jika user sudah memiliki faceId, tambahkan wajah ke person yang sudah ada
      console.log('Menambahkan wajah untuk personId:', personId);
      const result = await luxand.addFace(personId, req.file.path);

      // Hapus file setelah digunakan
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(200).json({
        message: 'Wajah berhasil ditambahkan',
        result
      });
    }
  } catch (error) {
    console.error('Error adding face:', error);
    
    // Hapus file jika terjadi error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({ message: 'Terjadi kesalahan saat menambahkan wajah', error: error.message });
  }
};

// Mendapatkan semua user (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'faceId', 'isActive', 'createdAt', 'updatedAt']
    });

    res.status(200).json({ users });
  } catch (error) {
    console.error('Error getting all users:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data user', error: error.message });
  }
}; 