import { prisma } from "../prisma/client";

export const addAttachment = async (req, res) => {
  const { ticketId } = req.body;
  const file = req.file;

  const attachment = await prisma.attachment.create({
    data: {
      ticketId,
      fileName: file.originalname,
      filePath: file.path,
      fileType: file.mimetype,
    },
  });

  res.status(201).json(attachment);
};

export const getTicketAttachments = async (req, res) => {
  const { ticketId } = req.params;

  const attachments = await prisma.attachment.findMany({
    where: { ticketId },
  });

  res.json(attachments);
};
