const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminUserSchema = new mongoose.Schema({
  username:    { type: String, required: true, unique: true, trim: true, lowercase: true },
  password:    { type: String, required: true },
  fullName:    { type: String, required: true, trim: true },
  // superadmin = Cán bộ quản trị (Admin), dept_leader = Cán bộ phòng ban, officer = Cán bộ phụ trách
  // staff giữ lại cho backward compat
  role:        { type: String, enum: ['superadmin', 'dept_leader', 'officer', 'staff'], default: 'officer' },
  zaloUserId:  { type: String, default: '' },
  categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  managedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
  createdAt:   { type: Date, default: Date.now },
});

adminUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

adminUserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('AdminUser', adminUserSchema);
