const jwt = require('jsonwebtoken');
const { User } = require('../models');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ where: { id: decoded.id } });

    if (!user) {
      throw new Error();
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).send({ error: 'Silakan autentikasi terlebih dahulu.' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user && req.user.role === 'admin') {
        next();
      } else {
        res.status(403).send({ error: 'Akses ditolak. Hanya admin yang diizinkan.' });
      }
    });
  } catch (error) {
    res.status(401).send({ error: 'Silakan autentikasi terlebih dahulu.' });
  }
};

module.exports = { auth, adminAuth }; 