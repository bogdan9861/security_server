const { prisma } = require("../prisma/prisma.client");
const uploadFile = require("../utlls/uploadFile");

const statuses = {
  NEW: "Новый",
  IN_PROGRESS: "В процессе",
  NEED_INFO: "Необходимы уточнения",
  CLOSED: "Закрыт",
  REJECTED: "Отклонён",
};

const createTicket = async (req, res) => {
  try {
    const { title, description, categoryId, priority } = req.body;
    const files = req.files;

    console.log(files);

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "At least one file is required" });
    }

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        categoryId,
        priority,
        clientId: req.user.id,
      },
      include: {
        category: true,
      },
    });

    for (const file of req.files) {
      try {
        const uploaded = await uploadFile(
          file.path,
          undefined,
          "ticket_attachments"
        );

        await prisma.attachment.create({
          data: {
            ticketId: ticket.id,
            fileName: file.originalname,
            filePath: uploaded.url,
            fileType: uploaded.resourceType,
          },
        });
      } catch (error) {
        res.status(500).json({ message: "Could not send image" });
        console.log(`${error}`);
      }
    }

    const admins = await prisma.user.findMany({
      where: {
        role: "ADMIN",
      },
    });

    if (admins?.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          type: "TICKET_CREATED",
          message: `Пользователь ${req.user.id} создал новый тикет \n Название: ${ticket.title} \n Комментарий: ${ticket.description} \n Срочность: ${ticket.priority} \n Категория: ${ticket.category.name}`,
          userId: admin.id,
          ticketId: ticket.id,
        })),
      });
    }

    const result = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { attachments: true },
    });

    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create ticket" });
  }
};

const getMyTickets = async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        clientId: req.user.id,
      },
      include: {
        category: true,
        attachments: true,
      },
    });

    res.status(200).json(tickets);
  } catch (error) {
    console.log(error);

    res.status(500);
  }
};

const getTickets = async (req, res) => {
  const tickets = await prisma.ticket.findMany({
    include: {
      category: true,
      assignedTo: true,
      client: true,
      attachments: true,
    },
  });

  res.json(tickets);
};

const getTicketById = async (req, res) => {
  const { id } = req.params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      comments: true,
      attachments: true,
      history: true,
    },
  });

  if (!ticket) return res.status(404).json({ message: "Ticket not found" });

  res.json(ticket);
};

const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log("123", id);

    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!existingTicket) {
      return res
        .status(404)
        .json({ message: "Cannot find ticket with specified id" });
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: { status },
    });

    await prisma.ticketHistory.create({
      data: {
        ticketId: id,
        userId: req.user.id,
        action: "STATUS_CHANGED",
        oldValue: existingTicket.status,
        newValue: status,
      },
    });

    await prisma.notification.create({
      data: {
        userId: ticket.clientId,
        message: `Статус вашего обращения на тему ${ticket.title}, был изменён на ${statuses[status]}`,
        type: "STATUS_CHANGED",
        ticketId: ticket.id,
      },
    });

    res.json(ticket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update ticket status" });
  }
};

const assignTicket = async (req, res) => {
  const { id } = req.params;
  const { assignedToId } = req.body;

  const ticket = await prisma.ticket.update({
    where: { id },
    data: { assignedToId },
  });

  res.json(ticket);
};

const getAssignedTicket = async (req, res) => {
  try {
    const { operatorId } = req.params;

    if (!operatorId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        assignedToId: operatorId,
      },
      include: {
        assignedTo: true,
        category: true,
      },
    });

    res.status(200).json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findFirst({
      where: {
        id,
      },
    });

    if (!ticket) {
      return res.status(200).json({
        message: "Cannot find ticket with specified id",
      });
    }

    await prisma.ticket.delete({
      where: {
        id,
      },
    });

    res.status(200).json({ message: "success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  assignTicket,
  getMyTickets,
  deleteTicket,
  getAssignedTicket,
};
