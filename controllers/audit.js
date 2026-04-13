import { prisma } from "../prisma/client";

export const getAuditLogs = async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(logs);
};
