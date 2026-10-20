const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'An account with that email already exists.' });

    const allowedRoles = ['external', 'club', 'manager', 'admin'];
    const finalRole = allowedRoles.includes(role) ? role : 'external';

    const user = await User.create({ name, email: email.toLowerCase(), password, role: finalRole });
    const token = generateToken(user);
    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(401).json({ message: 'No account matches that email and password.' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'No account matches that email and password.' });

    const token = generateToken(user);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user.toSafeObject() });
}

module.exports = { register, login, me };
