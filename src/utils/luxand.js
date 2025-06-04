const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class LuxandAPI {
  constructor(apiKey, apiUrl = 'https://api.luxand.cloud') {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    
    this.axios = axios.create({
      baseURL: this.apiUrl,
      headers: {
        token: this.apiKey
      }
    });
  }

  async createPerson(name) {
    try {
      console.log(`Membuat person baru dengan nama: ${name}`);
      console.log(`URL: ${this.apiUrl}/person`);
      console.log(`API Key: ${this.apiKey.substring(0, 5)}...`);
      
      console.log('CATATAN: API Luxand memerlukan parameter photo untuk membuat person baru');
      console.log('Gunakan createPersonWithFace sebagai gantinya');
      
      const response = await this.axios.post(
        '/person',
        { name },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Respons lengkap dari createPerson:', JSON.stringify(response.data));
      
      if (!response.data || !response.data.uuid) {
        throw new Error('Respons dari Luxand tidak mengandung UUID');
      }
      
      return response.data;
    } catch (error) {
      console.error('Error creating person:', error);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Headers:', error.response.headers);
        console.error('Data:', error.response.data);
      }
      throw error;
    }
  }

  async addFace(personId, photoPath) {
    try {
      console.log(`Menambahkan wajah untuk person ID: ${personId}`);
      console.log(`Path foto: ${photoPath}`);
      
      if (!personId) {
        throw new Error('Person ID tidak boleh kosong');
      }
      
      if (!fs.existsSync(photoPath)) {
        throw new Error(`File tidak ditemukan: ${photoPath}`);
      }
      
      const photo = fs.createReadStream(photoPath);
      
      const response = await this.axios.post(`/person/${personId}`, photo, {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      console.log('Respon dari Luxand API:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error adding face:', error.response?.data || error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Headers:', error.response.headers);
        console.error('Data:', error.response.data);
      }
      throw error;
    }
  }

  async recognize(photoPath) {
    try {
      console.log(`Mengenali wajah dari foto: ${photoPath}`);
      
      if (!fs.existsSync(photoPath)) {
        throw new Error(`File tidak ditemukan: ${photoPath}`);
      }
      
      const formData = new FormData();
      formData.append('photo', fs.createReadStream(photoPath));
      
      const response = await this.axios.post('/photo/search', formData);
      
      console.log('Respons dari Luxand API recognize:', JSON.stringify(response.data));
      return response.data;
    } catch (error) {
      console.error('Error recognizing face:', error.response?.data || error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Headers:', error.response.headers);
        console.error('Data:', error.response.data);
      }
      throw error;
    }
  }

  async verifyFace(personId, photoPath) {
    try {
      // Baca file foto
      const photo = fs.createReadStream(photoPath);
      
      // Kirim request ke API
      const response = await this.axios.post(`/person/${personId}/verify`, photo, {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error verifying face:', error.response?.data || error.message);
      throw error;
    }
  }

  async createPersonWithFace(name, photoPath) {
    try {
      console.log(`Membuat person baru dengan nama dan foto: ${name}`);
      
      if (!fs.existsSync(photoPath)) {
        throw new Error(`File tidak ditemukan: ${photoPath}`);
      }
      
      const photo = fs.createReadStream(photoPath);
      
      const formData = new FormData();
      formData.append('name', name);
      formData.append('photo', photo);
      
      const response = await this.axios.post('/person', formData);
      
      console.log('Respons lengkap dari createPersonWithFace:', JSON.stringify(response.data));
      
      if (!response.data || !response.data.uuid) {
        throw new Error('Respons dari Luxand tidak mengandung UUID');
      }
      
      return response.data;
    } catch (error) {
      console.error('Error creating person with face:', error.response?.data || error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Headers:', error.response.headers);
        console.error('Data:', error.response.data);
      }
      throw error;
    }
  }
}

// Buat instance dengan API key dari environment variable
const luxand = new LuxandAPI(process.env.LUXAND_API_KEY, process.env.LUXAND_API_URL);

module.exports = luxand; 