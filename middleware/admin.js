const admin = async (req, res, next) => {
  try {
    const { role } = req.user;

    if (role !== "ADMIN" && role !== "OPERATOR") {
      return res.status(403).json({
        message: "Forbiden for you",
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Check role error" });
  }
};

module.exports = {
  admin,
};
