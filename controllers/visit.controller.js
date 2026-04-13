const { PrismaClient, VisitStatus } = require("@prisma/client");
const { AppError } = require("../middlewares/error.middleware");

const prisma = new PrismaClient();

class VisitController {
  /**
   * Получить все визиты
   */
  static async getAll(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        patientId,
        doctorId,
        fromDate,
        toDate,
        hasSickLeave,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where = {};

      if (patientId) where.patientId = Number(patientId);
      if (doctorId) where.doctorId = Number(doctorId);
      if (hasSickLeave !== undefined) {
        where.sickLeaveIssued = hasSickLeave === "true";
      }

      if (fromDate || toDate) {
        where.visitDate = {};
        if (fromDate) where.visitDate.gte = new Date(String(fromDate));
        if (toDate) where.visitDate.lte = new Date(String(toDate));
      }

      const visits = await prisma.visit.findMany({
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
              phone: true,
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
          prescriptions: true,
          medicalRecords: true,
          appointment: true,
        },
        orderBy: { visitDate: "desc" },
      });

      const total = await prisma.visit.count({ where });

      res.json({
        success: true,
        data: visits,
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
   * Получить визит по ID
   */
  static async getOne(req, res, next) {
    try {
      const { id } = req.params;

      const visit = await prisma.visit.findUnique({
        where: { id: Number(id) },
        include: {
          patient: true,
          doctor: {
            include: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
          prescriptions: {
            orderBy: { createdAt: "desc" },
          },
          medicalRecords: {
            orderBy: { recordDate: "desc" },
          },
          appointment: {
            include: {
              registrator: {
                include: { user: true },
              },
            },
          },
        },
      });

      if (!visit) {
        throw new AppError("Визит не найден", 404);
      }

      // Логируем просмотр
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "VIEW",
            entityType: "Visit",
            entityId: visit.id,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.json({
        success: true,
        data: visit,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Создать новый визит (из записи или без)
   */
  static async create(req, res, next) {
    try {
      const {
        appointmentId,
        patientId,
        doctorId,
        visitDate,
        complaints,
        anamnesis,
        objectiveData,
        diagnosis,
        icd10Code,
        recommendations,
        sickLeaveIssued,
        sickLeaveNumber,
      } = req.body;

      // Проверяем, существует ли пациент
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
      });

      if (!patient) {
        throw new AppError("Пациент не найден", 404);
      }

      // Если указан appointmentId, проверяем его и обновляем статус
      let appointment;
      if (appointmentId) {
        appointment = await prisma.appointment.findUnique({
          where: { id: appointmentId },
        });

        if (!appointment) {
          throw new AppError("Запись не найдена", 404);
        }

        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { status: VisitStatus.COMPLETED },
        });
      }

      // Создаем визит
      const visit = await prisma.visit.create({
        data: {
          appointmentId: appointmentId || null,
          patientId,
          doctorId,
          visitDate: visitDate ? new Date(visitDate) : new Date(),
          complaints,
          anamnesis,
          objectiveData,
          diagnosis,
          icd10Code,
          recommendations,
          sickLeaveIssued: sickLeaveIssued || false,
          sickLeaveNumber,
        },
        include: {
          patient: true,
          doctor: {
            include: { user: true },
          },
        },
      });

      // Если указан диагноз, создаем запись в Diagnosis
      if (diagnosis && icd10Code) {
        await prisma.diagnosis.create({
          data: {
            patientId,
            doctorId,
            visitId: visit.id,
            icd10Code,
            name: diagnosis,
            diagnosedAt: new Date(),
            isPrimary: true,
            isActive: true,
          },
        });
      }

      // Логируем создание
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "CREATE",
            entityType: "Visit",
            entityId: visit.id,
            newValues: visit,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.status(201).json({
        success: true,
        data: visit,
        message: "Визит успешно создан",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Обновить визит
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingVisit = await prisma.visit.findUnique({
        where: { id: Number(id) },
      });

      if (!existingVisit) {
        throw new AppError("Визит не найден", 404);
      }

      // Обновляем визит
      const visit = await prisma.visit.update({
        where: { id: Number(id) },
        data: {
          ...updateData,
          visitDate: updateData.visitDate
            ? new Date(updateData.visitDate)
            : undefined,
        },
        include: {
          patient: true,
          doctor: {
            include: { user: true },
          },
        },
      });

      // Если обновился диагноз, добавляем новую запись
      if (updateData.diagnosis && updateData.icd10Code) {
        await prisma.diagnosis.create({
          data: {
            patientId: visit.patientId,
            doctorId: visit.doctorId,
            visitId: visit.id,
            icd10Code: updateData.icd10Code,
            name: updateData.diagnosis,
            diagnosedAt: new Date(),
            isActive: true,
          },
        });
      }

      // Логируем обновление
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "UPDATE",
            entityType: "Visit",
            entityId: visit.id,
            oldValues: existingVisit,
            newValues: visit,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.json({
        success: true,
        data: visit,
        message: "Визит обновлен",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Удалить визит
   */
  static async delete(req, res, next) {
    try {
      const { id } = req.params;

      const visit = await prisma.visit.findUnique({
        where: { id: Number(id) },
        include: { prescriptions: true, medicalRecords: true },
      });

      if (!visit) {
        throw new AppError("Визит не найден", 404);
      }

      // Удаляем визит (каскадно удалятся связанные записи)
      await prisma.visit.delete({
        where: { id: Number(id) },
      });

      // Возвращаем статус записи обратно на SCHEDULED если была
      if (visit.appointmentId) {
        await prisma.appointment.update({
          where: { id: visit.appointmentId },
          data: { status: VisitStatus.SCHEDULED },
        });
      }

      // Логируем удаление
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "DELETE",
            entityType: "Visit",
            entityId: visit.id,
            oldValues: visit,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.json({
        success: true,
        message: "Визит удален",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить визиты пациента
   */
  static async getPatientVisits(req, res, next) {
    try {
      const { limit = 50 } = req.query;

      const visits = await prisma.visit.findMany({
        where: { patientId: req?.user?.patientId },
        take: Number(limit),
        include: {
          doctor: {
            include: { user: true },
          },
          prescriptions: true,
          medicalRecords: {
            take: 5,
          },
        },
        orderBy: { visitDate: "desc" },
      });

      res.json({
        success: true,
        data: visits,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Создать назначение для визита
   */
  static async addPrescription(req, res, next) {
    try {
      const { id } = req.params;
      const {
        medicationName,
        dosage,
        administration,
        startDate,
        endDate,
        notes,
      } = req.body;

      const visit = await prisma.visit.findUnique({
        where: { id: Number(id) },
      });

      if (!visit) {
        throw new AppError("Визит не найден", 404);
      }

      const prescription = await prisma.prescription.create({
        data: {
          patientId: visit.patientId,
          doctorId: visit.doctorId,
          visitId: visit.id,
          medicationName,
          dosage,
          administration,
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: new Date(endDate),
          notes,
        },
      });

      res.status(201).json({
        success: true,
        data: prescription,
        message: "Назначение добавлено",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить статистику визитов
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

      const [totalVisits, visitsByDoctor, sickLeaves, topDiagnoses] =
        await Promise.all([
          prisma.visit.count({
            where: { visitDate: { gte: startDate } },
          }),
          prisma.visit.groupBy({
            by: ["doctorId"],
            where: { visitDate: { gte: startDate } },
            _count: { id: true },
          }),
          prisma.visit.count({
            where: {
              sickLeaveIssued: true,
              visitDate: { gte: startDate },
            },
          }),
          prisma.diagnosis.groupBy({
            by: ["icd10Code", "name"],
            where: { diagnosedAt: { gte: startDate } },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 10,
          }),
        ]);

      // Получаем имена врачей
      const doctorsWithCounts = await Promise.all(
        visitsByDoctor.map(async (item) => {
          const doctor = await prisma.doctor.findUnique({
            where: { id: item.doctorId },
            include: { user: true },
          });
          return {
            doctorId: item.doctorId,
            doctorName: doctor
              ? `${doctor.user.email} (${doctor.specialization})`
              : "Unknown",
            visitCount: item._count.id,
          };
        })
      );

      res.json({
        success: true,
        data: {
          period,
          startDate,
          totalVisits,
          sickLeaves,
          visitsByDoctor: doctorsWithCounts,
          topDiagnoses: topDiagnoses.map((d) => ({
            code: d.icd10Code,
            name: d.name,
            count: d._count.id,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { VisitController };
