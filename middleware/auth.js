const jwt = require("jsonwebtoken");
const { prisma } = require("../prisma/prisma.client");

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.decode(token, process.env.SECRET);

    const user = await prisma.user.findFirst({
      where: {
        id: decoded.id,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Unauthorized" });
    }

    req.user = user;

    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Token error" });
  }
};

module.exports = { auth };
