const { PrismaClient } = require("@prisma/client");
const { AppError } = require("../middlewares/error.middleware");

const prisma = new PrismaClient();

class DiagnosisController {
  /**
   * Получить все диагнозы
   */
  static async getAll(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        patientId,
        isActive,
        icd10Code,
        fromDate,
        toDate,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where = {};

      if (patientId) where.patientId = Number(patientId);
      if (isActive !== undefined) where.isActive = isActive === "true";
      if (icd10Code) where.icd10Code = { contains: String(icd10Code) };

      if (fromDate || toDate) {
        where.diagnosedAt = {};
        if (fromDate) where.diagnosedAt.gte = new Date(String(fromDate));
        if (toDate) where.diagnosedAt.lte = new Date(String(toDate));
      }

      const diagnoses = await prisma.diagnosis.findMany({
        where,
        skip,
        take,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              birthDate: true,
            },
          },
          doctor: {
            include: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
          visit: {
            select: {
              id: true,
              visitDate: true,
            },
          },
        },
        orderBy: { diagnosedAt: "desc" },
      });

      const total = await prisma.diagnosis.count({ where });

      res.json({
        success: true,
        data: diagnoses,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить диагноз по ID
   */
  static async getOne(req, res, next) {
    try {
      const { id } = req.params;

      const diagnosis = await prisma.diagnosis.findUnique({
        where: { id: Number(id) },
        include: {
          patient: true,
          doctor: {
            include: { user: true },
          },
          visit: true,
        },
      });

      if (!diagnosis) {
        throw new AppError("Диагноз не найден", 404);
      }

      res.json({
        success: true,
        data: diagnosis,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Создать новый диагноз
   */
  static async create(req, res, next) {
    try {
      const {
        patientId,
        doctorId,
        visitId,
        icd10Code,
        name,
        description,
        isPrimary,
        diagnosedAt,
      } = req.body;

      // Проверяем существование пациента
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
      });

      if (!patient) {
        throw new AppError("Пациент не найден", 404);
      }

      // Если это основной диагноз, снимаем флаг isPrimary с других диагнозов
      if (isPrimary) {
        await prisma.diagnosis.updateMany({
          where: { patientId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      // Создаем диагноз
      const diagnosis = await prisma.diagnosis.create({
        data: {
          patientId,
          doctorId,
          visitId: visitId || null,
          icd10Code,
          name,
          description,
          isPrimary: isPrimary || false,
          isActive: true,
          diagnosedAt: diagnosedAt ? new Date(diagnosedAt) : new Date(),
        },
        include: {
          patient: true,
          doctor: {
            include: { user: true },
          },
        },
      });

      // Логируем создание
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "CREATE",
            entityType: "Diagnosis",
            entityId: diagnosis.id,
            newValues: diagnosis,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.status(201).json({
        success: true,
        data: diagnosis,
        message: "Диагноз добавлен",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Обновить диагноз
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { icd10Code, name, description, isPrimary, isActive, resolvedAt } =
        req.body;

      const existingDiagnosis = await prisma.diagnosis.findUnique({
        where: { id: Number(id) },
      });

      if (!existingDiagnosis) {
        throw new AppError("Диагноз не найден", 404);
      }

      // Если устанавливаем как основной, снимаем флаг с других
      if (isPrimary) {
        await prisma.diagnosis.updateMany({
          where: { patientId: existingDiagnosis.patientId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const diagnosis = await prisma.diagnosis.update({
        where: { id: Number(id) },
        data: {
          icd10Code: icd10Code || undefined,
          name: name || undefined,
          description: description || undefined,
          isPrimary: isPrimary !== undefined ? isPrimary : undefined,
          isActive: isActive !== undefined ? isActive : undefined,
          resolvedAt: resolvedAt ? new Date(resolvedAt) : undefined,
        },
        include: {
          patient: true,
          doctor: {
            include: { user: true },
          },
        },
      });

      // Логируем обновление
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "UPDATE",
            entityType: "Diagnosis",
            entityId: diagnosis.id,
            oldValues: existingDiagnosis,
            newValues: diagnosis,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.json({
        success: true,
        data: diagnosis,
        message: "Диагноз обновлен",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Удалить диагноз
   */
  static async delete(req, res, next) {
    try {
      const { id } = req.params;

      const diagnosis = await prisma.diagnosis.findUnique({
        where: { id: Number(id) },
      });

      if (!diagnosis) {
        throw new AppError("Диагноз не найден", 404);
      }

      await prisma.diagnosis.delete({
        where: { id: Number(id) },
      });

      // Логируем удаление
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "DELETE",
            entityType: "Diagnosis",
            entityId: diagnosis.id,
            oldValues: diagnosis,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.json({
        success: true,
        message: "Диагноз удален",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить активные диагнозы пациента
   */
  static async getActiveByPatient(req, res, next) {
    try {
      const diagnoses = await prisma.diagnosis.findMany({
        where: {
          patientId: Number(req?.user?.patientId),
          isActive: true,
        },
        include: {
          doctor: {
            include: { user: true },
          },
          visit: true,
        },
        orderBy: { diagnosedAt: "desc" },
      });

      res.json({
        success: true,
        data: diagnoses,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Поиск по коду МКБ-10
   */
  static async searchByIcd10(req, res, next) {
    try {
      const { code, name } = req.query;

      const where = {};

      if (code) {
        where.icd10Code = { contains: String(code) };
      }

      if (name) {
        where.name = { contains: String(name) };
      }

      const diagnoses = await prisma.diagnosis.findMany({
        where,
        take: 50,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
            },
          },
        },
        orderBy: { diagnosedAt: "desc" },
      });

      res.json({
        success: true,
        data: diagnoses,
        count: diagnoses.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить статистику по диагнозам
   */
  static async getStatistics(req, res, next) {
    try {
      const { period = "month" } = req.query;

      let startDate = new Date();
      if (period === "week") {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === "month") {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (period === "year") {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }

      const [
        totalDiagnoses,
        topIcd10Codes,
        diagnosesByDoctor,
        activeDiagnoses,
      ] = await Promise.all([
        prisma.diagnosis.count({
          where: { diagnosedAt: { gte: startDate } },
        }),
        prisma.diagnosis.groupBy({
          by: ["icd10Code", "name"],
          where: { diagnosedAt: { gte: startDate } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),
        prisma.diagnosis.groupBy({
          by: ["doctorId"],
          where: { diagnosedAt: { gte: startDate } },
          _count: { id: true },
        }),
        prisma.diagnosis.count({
          where: { isActive: true },
        }),
      ]);

      // Получаем имена врачей
      const doctorsWithCounts = await Promise.all(
        diagnosesByDoctor.map(async (item) => {
          const doctor = await prisma.doctor.findUnique({
            where: { id: item.doctorId },
            include: { user: true },
          });
          return {
            doctorId: item.doctorId,
            doctorName: doctor
              ? `${doctor.user.email} (${doctor.specialization})`
              : "Unknown",
            diagnosisCount: item._count.id,
          };
        })
      );

      res.json({
        success: true,
        data: {
          period,
          startDate,
          totalDiagnoses,
          activeDiagnoses,
          topDiagnoses: topIcd10Codes.map((d) => ({
            code: d.icd10Code,
            name: d.name,
            count: d._count.id,
          })),
          diagnosesByDoctor: doctorsWithCounts,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { DiagnosisController };
