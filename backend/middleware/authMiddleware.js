const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Allows the request only if it carries a valid login token (FR-4)
const protect = async (req, res, next) => {
    let user = null;
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const { id } = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(id).select('-password');
    } catch { /* invalid or missing token */ }

    if (!user) return res.status(401).json({ message: 'Not authorized, please log in again' });
    req.user = user;
    next();
};

module.exports = { protect };
