const { PrismaClient } = require("@prisma/client");
const { AppError } = require("../middlewares/error.middleware");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

class PatientController {
  /**
   * Получить всех пациентов с пагинацией и фильтрацией
   */
  static async getAll(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        isArchived = false,
        gender,
        fromDate,
        toDate,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Построение фильтров
      const where = { isArchived: isArchived === "true" };

      if (search) {
        where.OR = [
          { firstName: { contains: String(search) } },
          { lastName: { contains: String(search) } },
          { middleName: { contains: String(search) } },
          { phone: { contains: String(search) } },
          { snils: { contains: String(search) } },
          { policyNumber: { contains: String(search) } },
        ];
      }

      if (gender) {
        where.gender = gender;
      }

      if (fromDate || toDate) {
        where.birthDate = {};
        if (fromDate) where.birthDate.gte = new Date(String(fromDate));
        if (toDate) where.birthDate.lte = new Date(String(toDate));
      }

      // Получаем пациентов
      const patients = await prisma.patient.findMany({
        where,
        skip,
        take,
        orderBy: { lastName: "asc" },
        include: {
          visits: {
            take: 1,
            orderBy: { visitDate: "desc" },
          },
          diagnoses: {
            where: { isActive: true },
          },
        },
      });

      // Получаем общее количество
      const total = await prisma.patient.count({ where });

      // Логируем действие
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "VIEW_LIST",
            entityType: "Patient",
            entityId: 0,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.json({
        success: true,
        data: patients,
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
   * Получить пациента по ID
   */
  static async getOne(req, res, next) {
    try {
      const { id } = req.params;

      const patient = await prisma.patient.findUnique({
        where: { id: Number(id) },
        include: {
          visits: {
            orderBy: { visitDate: "desc" },
            include: {
              doctor: {
                include: { user: true },
              },
              prescriptions: true,
            },
          },
          diagnoses: {
            orderBy: { diagnosedAt: "desc" },
            include: { doctor: { include: { user: true } } },
          },
          medicalCard: true,
          insurancePolicies: {
            where: { isActive: true },
          },
          documents: {
            orderBy: { uploadedAt: "desc" },
          },
          appointments: {
            where: {
              appointmentTime: { gte: new Date() },
              status: "SCHEDULED",
            },
            orderBy: { appointmentTime: "asc" },
            include: {
              doctor: {
                include: { user: true },
              },
            },
          },
        },
      });

      if (!patient) {
        throw new AppError("Пациент не найден", 404);
      }

      // Логируем просмотр
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "VIEW",
            entityType: "Patient",
            entityId: patient.id,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.json({
        success: true,
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Создать нового пациента
   */
  static async create(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        middleName,
        birthDate,
        gender,
        snils,
        policyNumber,
        policyCompany,
        phone,
        phoneSecondary,
        email,
        address,
        password,
      } = req.body;

      if (!email) {
        throw new AppError("Email обязателен для создания учетной записи", 400);
      }

      if (!password) {
        throw new AppError(
          "Пароль обязателен для создания учетной записи",
          400
        );
      }

      // Проверка на дубликаты
      if (snils) {
        const existingPatient = await prisma.patient.findUnique({
          where: { snils },
        });
        if (existingPatient) {
          throw new AppError("Пациент с таким СНИЛС уже существует", 409);
        }
      }

      if (policyNumber) {
        const existingPatient = await prisma.patient.findUnique({
          where: { policyNumber },
        });
        if (existingPatient) {
          throw new AppError(
            "Пациент с таким номером полиса уже существует",
            409
          );
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await prisma.$transaction(async (prisma) => {
        // 1. Создаем пользователя
        const user = await prisma.user.create({
          data: {
            email,
            passwordHash: hashedPassword,
            role: "PATIENT",
            isActive: true,
          },
        });

        // 2. Создаем пациента, связывая с пользователем
        const patient = await prisma.patient.create({
          data: {
            firstName,
            lastName,
            middleName,
            birthDate: new Date(birthDate),
            gender,
            snils,
            policyNumber,
            policyCompany,
            phone,
            phoneSecondary,
            email,
            address,
            createdBy: req.user?.id,
            userId: user.id, // Связываем с созданным пользователем
          },
        });

        // 3. Создаем медицинскую карту
        const cardNumber = `MC-${patient.id}-${Date.now()}`;
        await prisma.medicalCard.create({
          data: {
            patientId: patient.id,
            cardNumber,
          },
        });

        return { user, patient };
      });

      // Логируем создание
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "CREATE",
            entityType: "Patient",
            entityId: result.patient.id,
            newValues: result.patient,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.status(201).json({
        success: true,
        data: {
          patient: result.patient,
          user: {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
          },
        },
        message: "Пациент успешно создан. Учетная запись создана.",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Обновить данные пациента
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Проверяем существование
      const existingPatient = await prisma.patient.findUnique({
        where: { id: Number(id) },
      });

      if (!existingPatient) {
        throw new AppError("Пациент не найден", 404);
      }

      // Проверка на дубликаты при обновлении
      if (updateData.snils && updateData.snils !== existingPatient.snils) {
        const duplicate = await prisma.patient.findUnique({
          where: { snils: updateData.snils },
        });
        if (duplicate) {
          throw new AppError("Пациент с таким СНИЛС уже существует", 409);
        }
      }

      // Обновляем
      const patient = await prisma.patient.update({
        where: { id: Number(id) },
        data: {
          ...updateData,
          birthDate: updateData.birthDate
            ? new Date(updateData.birthDate)
            : undefined,
          updatedAt: new Date(),
        },
      });

      // Логируем обновление
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "UPDATE",
            entityType: "Patient",
            entityId: patient.id,
            oldValues: existingPatient,
            newValues: patient,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.json({
        success: true,
        data: patient,
        message: "Данные пациента обновлены",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Удалить пациента (архивировать)
   */
  static async delete(req, res, next) {
    try {
      const { id } = req.params;

      const patient = await prisma.patient.update({
        where: { id: Number(id) },
        data: { isArchived: true },
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "DELETE",
            entityType: "Patient",
            entityId: patient.id,
            oldValues: patient,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.json({
        success: true,
        message: "Пациент архивирован",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Поиск пациентов по различным критериям
   */
  static async search(req, res, next) {
    try {
      const { query, field = "all" } = req.query;

      if (!query) {
        throw new AppError("Введите поисковый запрос", 400);
      }

      let where = {};

      if (field === "snils") {
        where.snils = { contains: String(query) };
      } else if (field === "policy") {
        where.policyNumber = { contains: String(query) };
      } else if (field === "phone") {
        where.phone = { contains: String(query) };
      } else {
        where.OR = [
          { firstName: { contains: String(query) } },
          { lastName: { contains: String(query) } },
          { middleName: { contains: String(query) } },
          { snils: { contains: String(query) } },
          { policyNumber: { contains: String(query) } },
          { phone: { contains: String(query) } },
        ];
      }

      const patients = await prisma.patient.findMany({
        where,
        take: 50,
        orderBy: { lastName: "asc" },
      });

      res.json({
        success: true,
        data: patients,
        count: patients.length,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { PatientController };
