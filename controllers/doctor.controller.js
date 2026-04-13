const { PrismaClient } = require("@prisma/client");
const { AppError } = require("../middlewares/error.middleware");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

class DoctorController {
  /**
   * Получить всех врачей
   */
  static async getAll(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        specialization,
        isOnVacation,
        search,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where = {};

      if (specialization) {
        where.specialization = { contains: String(specialization) };
      }

      if (isOnVacation !== undefined) {
        where.isOnVacation = isOnVacation === "true";
      }

      if (search) {
        where.OR = [
          { user: { email: { contains: String(search) } } },
          { specialization: { contains: String(search) } },
        ];
      }

      const doctors = await prisma.doctor.findMany({
        where,
        skip,
        take,
        include: {
          user: true,
        },
        orderBy: { specialization: "asc" },
      });

      const total = await prisma.doctor.count({ where });

      res.json({
        success: true,
        data: doctors,
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
   * Получить врача по ID
   */
  static async getOne(req, res, next) {
    try {
      const { id } = req.params;

      const doctor = await prisma.doctor.findUnique({
        where: { id: Number(id) },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
          visits: {
            take: 10,
            orderBy: { visitDate: "desc" },
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
          },
          appointments: {
            where: {
              appointmentTime: { gte: new Date() },
              status: "SCHEDULED",
            },
            orderBy: { appointmentTime: "asc" },
            include: {
              patient: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  middleName: true,
                  phone: true,
                },
              },
            },
          },
        },
      });

      if (!doctor) {
        throw new AppError("Врач не найден", 404);
      }

      res.json({
        success: true,
        data: doctor,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Создать нового врача (только админ)
   */
  static async create(req, res, next) {
    try {
      const {
        email,
        password, // Обязательное поле
        specialization,
        qualification,
        experienceYears,
        cabinetNumber,
        workSchedule,
        firstName, // Добавляем для полноты
        lastName, // Добавляем для полноты
        phone, // Добавляем для полноты
      } = req.body;

      // Проверяем наличие обязательных полей
      if (!email) {
        throw new AppError("Email обязателен для заполнения", 400);
      }

      if (!password) {
        throw new AppError("Пароль обязателен для заполнения", 400);
      }

      if (!specialization) {
        throw new AppError("Специализация обязательна для заполнения", 400);
      }

      // Проверяем, существует ли пользователь с таким email
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new AppError("Пользователь с таким email уже существует", 409);
      }

      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(password, 10);

      // Создаем пользователя и врача в транзакции
      const result = await prisma.$transaction(async (prisma) => {
        const user = await prisma.user.create({
          data: {
            email,
            passwordHash: hashedPassword,
            role: "DOCTOR",
            isActive: true,
            firstName,
            lastName,
            phone,
          },
        });

        const doctor = await prisma.doctor.create({
          data: {
            userId: user.id,
            specialization,
            qualification: qualification || null,
            experienceYears: experienceYears ? Number(experienceYears) : null,
            cabinetNumber: cabinetNumber || null,
            workSchedule: workSchedule || {},
            isOnVacation: false,
          },
          include: {
            user: true,
          },
        });

        return doctor;
      }, 10000);

      // Логируем создание
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "CREATE",
            entityType: "Doctor",
            entityId: result.id,
            newValues: result,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.status(201).json({
        success: true,
        data: result,
        message: "Врач успешно создан",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Обновить данные врача
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const {
        specialization,
        qualification,
        experienceYears,
        cabinetNumber,
        workSchedule,
        isOnVacation,
        isActive,
      } = req.body;

      const existingDoctor = await prisma.doctor.findUnique({
        where: { id: Number(id) },
        include: { user: true },
      });

      if (!existingDoctor) {
        throw new AppError("Врач не найден", 404);
      }

      // Обновляем врача
      const doctor = await prisma.doctor.update({
        where: { id: Number(id) },
        data: {
          specialization: specialization || undefined,
          qualification: qualification || undefined,
          experienceYears: experienceYears
            ? Number(experienceYears)
            : undefined,
          cabinetNumber: cabinetNumber || undefined,
          workSchedule: workSchedule || undefined,
          isOnVacation: isOnVacation !== undefined ? isOnVacation : undefined,
        },
        include: {
          user: true,
        },
      });

      // Обновляем статус пользователя если нужно
      if (isActive !== undefined) {
        await prisma.user.update({
          where: { id: existingDoctor.userId },
          data: { isActive },
        });
      }

      // Логируем обновление
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "UPDATE",
            entityType: "Doctor",
            entityId: doctor.id,
            oldValues: existingDoctor,
            newValues: doctor,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.json({
        success: true,
        data: doctor,
        message: "Данные врача обновлены",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Удалить врача (деактивировать)
   */
  static async delete(req, res, next) {
    try {
      const { id } = req.params;

      const doctor = await prisma.doctor.findUnique({
        where: { id: Number(id) },
      });

      if (!doctor) {
        throw new AppError("Врач не найден", 404);
      }

      // Деактивируем пользователя вместо удаления
      await prisma.user.update({
        where: { id: doctor.userId },
        data: { isActive: false },
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "DELETE",
            entityType: "Doctor",
            entityId: doctor.id,
            oldValues: doctor,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.json({
        success: true,
        message: "Врач деактивирован",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить расписание врача на неделю
   */
  static async getSchedule(req, res, next) {
    try {
      const { id } = req.params;
      const { startDate } = req.query;

      const doctor = await prisma.doctor.findUnique({
        where: { id: Number(id) },
      });

      if (!doctor) {
        throw new AppError("Врач не найден", 404);
      }

      const start = startDate ? new Date(String(startDate)) : new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      // Получаем все записи врача на неделю
      const appointments = await prisma.appointment.findMany({
        where: {
          doctorId: Number(id),
          appointmentTime: {
            gte: start,
            lt: end,
          },
          status: { not: "CANCELLED" },
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              phone: true,
            },
          },
        },
        orderBy: { appointmentTime: "asc" },
      });

      // Группируем по дням
      const schedule = {};
      appointments.forEach((appointment) => {
        const dateKey = appointment.appointmentTime.toISOString().split("T")[0];
        if (!schedule[dateKey]) {
          schedule[dateKey] = [];
        }
        schedule[dateKey].push(appointment);
      });

      res.json({
        success: true,
        data: {
          doctor,
          schedule,
          weekStart: start,
          weekEnd: end,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить статистику врача
   */
  static async getStatistics(req, res, next) {
    try {
      const { id } = req.params;
      const { period = "month" } = req.query;

      let startDate = new Date();
      if (period === "week") {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === "month") {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (period === "year") {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }

      const [totalVisits, uniquePatients, completedAppointments, diagnoses] =
        await Promise.all([
          prisma.visit.count({
            where: {
              doctorId: Number(id),
              visitDate: { gte: startDate },
            },
          }),
          prisma.visit.groupBy({
            by: ["patientId"],
            where: {
              doctorId: Number(id),
              visitDate: { gte: startDate },
            },
          }),
          prisma.appointment.count({
            where: {
              doctorId: Number(id),
              status: "COMPLETED",
              appointmentTime: { gte: startDate },
            },
          }),
          prisma.diagnosis.count({
            where: {
              doctorId: Number(id),
              diagnosedAt: { gte: startDate },
            },
          }),
        ]);

      res.json({
        success: true,
        data: {
          period,
          startDate,
          totalVisits,
          uniquePatients: uniquePatients.length,
          completedAppointments,
          diagnoses,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { DoctorController };
