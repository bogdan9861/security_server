const { prisma } = require("../prisma/prisma.client");

const getMyNotifications = async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    include: {
      ticket: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(notifications);
};

const markAsRead = async (req, res) => {
  const { id } = req.params;

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  res.sendStatus(204);
};

const getUnreadCount = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });

    return res.status(200).json({ count: notifications.length });
  } catch (error) {
    res.status(500).json({ message: "Unknown server error" });
    console.log(error);
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  getUnreadCount,
};
