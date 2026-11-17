const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const sendUser = (res, user, status = 200) => res.status(status).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    token: jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' }),
});

// POST /api/auth/register
const register = async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Please fill in all fields' });
    if (await User.exists({ email })) return res.status(400).json({ message: 'User already exists' });
    sendUser(res, await User.create({ name, email, password }), 201);
};

// POST /api/auth/login
const login = async (req, res) => {
    const { email, password } = req.body;
    const user = email && await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password || '', user.password))) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
    sendUser(res, user);
};

// GET /api/auth/me
const getMe = (req, res) => res.json(req.user);

module.exports = { register, login, getMe };
