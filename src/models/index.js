const User = require('./User');
const Attendance = require('./Attendance');

// Relasi antara User dan Attendance
User.hasMany(Attendance, { foreignKey: 'userId' });
Attendance.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  User,
  Attendance
}; 