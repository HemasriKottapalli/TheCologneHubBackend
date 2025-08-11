const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Optional: check if email is already registered
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: "Username or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: "user",
    });

    await newUser.save();
    res.status(201).json({ message: `User registered with username ${username}` });
  } catch (err) {
    res.status(500).json({ message: "something went wrong" });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Try finding user by username or email
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: `No user found with that username or email` });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: `Invalid credentials` });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      token,
      role: user.role,
      username: user.username,
      email: user.email, // ✅ include email
    });
  } catch (err) {
    res.status(500).json({ message: 'Something went wrong' });
  }
};


module.exports = {
    register,
    login
};

// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const User = require("../models/User");

// const register = async (req, res) => {
//   try {
//     const { username, email, password } = req.body;

//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ message: "Email already exists" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const newUser = new User({
//       username,
//       email,
//       password: hashedPassword,
//       role: "user",
//     });

//     await newUser.save();
//     res.status(201).json({ message: `User registered with email ${email}` });
//   } catch (err) {
//     res.status(500).json({ message: "something went wrong" });
//   }
// };

// const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const user = await User.findOne({ email });

//     if (!user) {
//       return res
//         .status(404)
//         .json({ message: `No user found with that email` });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       return res.status(400).json({ message: `Invalid credentials` });
//     }

//     const token = jwt.sign(
//       { id: user._id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: '1h' }
//     );

//     res.status(200).json({
//       token,
//       role: user.role,
//       username: user.username,
//       email: user.email,
//     });
//   } catch (err) {
//     res.status(500).json({ message: 'Something went wrong' });
//   }
// };

// module.exports = {
//     register,
//     login
// };