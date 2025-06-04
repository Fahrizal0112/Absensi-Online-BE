// src/controllers/publicUserController.js
const { User } = require('../models');
const luxand = require('../utils/luxand');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Registrasi wajah tanpa perlu login (hanya menambahkan wajah)
exports.registerFace = async (req, res) => {
  try {
    // Tambahkan log untuk debug
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    // Pastikan mengakses req.body dengan benar
    const name = req.body.name;
    const email = req.body.email;
    
    if (!name || !email) {
      return res.status(400).json({ message: 'Nama dan email diperlukan' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'Foto wajah diperlukan' });
    }

    // Cek apakah email sudah terdaftar
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      // Jika user sudah ada, tambahkan wajah ke user tersebut
      try {
        // Jika user sudah memiliki faceId, tambahkan wajah ke person yang sudah ada
        if (existingUser.faceId) {
          const result = await luxand.addFace(existingUser.faceId, req.file.path);
          
          // Hapus file setelah digunakan
          fs.unlinkSync(req.file.path);
          
          return res.status(200).json({
            message: 'Wajah berhasil ditambahkan ke profil yang sudah ada',
            user: {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email
            }
          });
        } else {
          // Jika user belum memiliki faceId, buat person baru dengan foto
          // PENTING: Gunakan nama user yang tepat sama dengan yang tersimpan di database
          const person = await luxand.createPersonWithFace(existingUser.name, req.file.path);
          
          if (!person || !person.uuid) {
            throw new Error('Respons dari Luxand tidak mengandung UUID');
          }
          
          // Update user dengan faceId baru
          await existingUser.update({ faceId: person.uuid });
          
          // Hapus file setelah digunakan
          fs.unlinkSync(req.file.path);
          
          return res.status(200).json({
            message: 'Wajah berhasil ditambahkan ke profil',
            user: {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email
            }
          });
        }
      } catch (error) {
        console.error('Error adding face:', error);
        
        // Hapus file jika terjadi error
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(500).json({ 
          message: 'Terjadi kesalahan saat menambahkan wajah', 
          error: error.message 
        });
      }
    }

    // Jika user belum ada, buat user baru dengan wajah
    try {
      // Buat person di Luxand dengan foto
      const person = await luxand.createPersonWithFace(name, req.file.path);
      
      if (!person || !person.uuid) {
        throw new Error('Respons dari Luxand tidak mengandung UUID');
      }
      
      // Buat user baru dengan password acak (karena tidak akan digunakan untuk login)
      const randomPassword = uuidv4();
      const user = await User.create({
        name,
        email,
        password: randomPassword,
        role: 'user',
        faceId: person.uuid
      });
      
      // Hapus file setelah digunakan
      fs.unlinkSync(req.file.path);
      
      return res.status(201).json({
        message: 'Registrasi wajah berhasil',
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Error registering face:', error);
      
      // Hapus file jika terjadi error
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({ 
        message: 'Terjadi kesalahan saat registrasi wajah', 
        error: error.message 
      });
    }
  } catch (error) {
    console.error('Error in registerFace:', error);
    
    // Hapus file jika terjadi error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      message: 'Terjadi kesalahan saat registrasi wajah', 
      error: error.message 
    });
  }
};