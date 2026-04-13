const { prisma } = require("../prisma/prisma.client");

const addComment = async (req, res) => {
  const { ticketId, content, isInternal } = req.body;

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
    },
  });

  const comment = await prisma.comment.create({
    data: {
      content,
      isInternal,
      ticketId,
      authorId: req.user.id,
    },
  });

  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
    },
  });

  if (req.user.role === "admin") {
    await prisma.notification.create({
      data: {
        userId: ticket.clientId,
        message: `Новый комментарий к вашему обращению ${ticket.title}: ${content}`,
        type: "COMMENT_ADDED",
        ticketId: ticketId,
      },
    });
  } else if (req.user.role === "CLIENT") {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        message: `Пользователь оставил комментарий к обращению ${ticket.title}: ${content}`,
        type: "COMMENT_ADDED",
        ticketId: ticketId,
      })),
    });
  }

  res.status(201).json(comment);
};

const getTicketComments = async (req, res) => {
  const { ticketId } = req.params;

  const comments = await prisma.comment.findMany({
    where: { ticketId },
    include: { author: true },
  });

  res.json(comments);
};

module.exports = {
  addComment,
  getTicketComments,
};
