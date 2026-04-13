const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { AppError } = require("../middlewares/error.middleware");

const prisma = new PrismaClient();

class AuthController {
  /**
   * Вход в систему
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Находим пользователя
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          doctorProfile: true,
          registratorProfile: true,
        },
      });

      if (!user) {
        throw new AppError("Неверный email или пароль", 401);
      }

      // Проверяем пароль
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        throw new AppError("Неверный email или пароль", 401);
      }

      // Проверяем активность
      if (!user.isActive) {
        throw new AppError("Учетная запись деактивирована", 403);
      }

      // Создаем сессию
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          token: uuidv4(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 дней
        },
        include: {
          user: {
            include: {
              patients: true,
            },
          },
        },
      });

      // Генерируем JWT
      const jwtSecret = process.env.JWT_SECRET || "secret-key";
      const token = jwt.sign(
        { userId: user.id, sessionId: session.id },
        jwtSecret,
        { expiresIn: "7d" }
      );

      // Логируем вход
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          entityType: "User",
          entityId: user.id,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });

      // Отправляем ответ
      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            doctorId: user.doctorProfile?.id,
            registratorId: user.registratorProfile?.id,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Выход из системы
   */
  static async logout(req, res, next) {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (token) {
        const decoded = jwt.decode(token);
        if (decoded?.sessionId) {
          await prisma.session.delete({
            where: { id: decoded.sessionId },
          });
        }
      }

      res.json({
        success: true,
        message: "Выход выполнен успешно",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получение текущего пользователя
   */
  static async getMe(req, res, next) {
    try {
      if (!req.user) {
        throw new AppError("Не авторизован", 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          doctorProfile: true,
          registratorProfile: true,
          patients: true,
        },
      });

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Смена пароля
   */
  static async changePassword(req, res, next) {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError("Не авторизован", 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError("Пользователь не найден", 404);
      }

      const isValidPassword = await bcrypt.compare(
        oldPassword,
        user.passwordHash
      );
      if (!isValidPassword) {
        throw new AppError("Неверный текущий пароль", 401);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashedPassword },
      });

      res.json({
        success: true,
        message: "Пароль успешно изменен",
      });
    } catch (error) {
      next(error);
    }
  }

  static async register(req, res, next) {
    try {
      const {
        email,
        password,
        confirmPassword,
        role,
        firstName,
        lastName,
        phone,
      } = req.body;

      // Проверка паролей
      if (password !== confirmPassword) {
        throw new AppError("Пароли не совпадают", 400);
      }

      // Проверка существования пользователя
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new AppError("Пользователь с таким email уже существует", 409);
      }

      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(password, 10);

      // Создаем пользователя в транзакции
      const result = await prisma.$transaction(async (prisma) => {
        const user = await prisma.user.create({
          data: {
            email,
            passwordHash: hashedPassword,
            role: role || "DOCTOR",
            isActive: true,
            firstName,
            lastName,
            phone,
          },
        });

        // Если роль DOCTOR, создаем профиль врача
        if (role === "DOCTOR") {
          await prisma.doctor.create({
            data: {
              userId: user.id,
              specialization: "Терапевт",
              qualification: "Врач",
            },
          });
        }

        // Если роль REGISTRATOR, создаем профиль регистратора
        if (role === "REGISTRATOR") {
          await prisma.registrator.create({
            data: {
              userId: user.id,
            },
          });
        }

        return user;
      });

      // Логируем регистрацию
      await prisma.auditLog.create({
        data: {
          userId: result.id,
          action: "REGISTER",
          entityType: "User",
          entityId: result.id,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });

      res.status(201).json({
        success: true,
        message: "Регистрация успешно завершена",
        data: {
          email: result.email,
          role: result.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Запрос на восстановление пароля
   */
  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Не показываем, что пользователь не найден (безопасность)
        return res.json({
          success: true,
          message:
            "Если пользователь существует, инструкция по восстановлению отправлена на email",
        });
      }

      // Генерируем токен сброса
      const resetToken = uuidv4();
      const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 час

      // Сохраняем токен в БД
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpires,
        },
      });

      // В реальном приложении здесь отправляется email
      // Для демонстрации возвращаем токен в ответе
      console.log(`Reset token for ${email}: ${resetToken}`);

      res.json({
        success: true,
        message: "Инструкция по восстановлению пароля отправлена на ваш email",
        // В разработке можно вернуть токен для тестирования
        ...(process.env.NODE_ENV === "development" && { resetToken }),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Сброс пароля
   */
  static async resetPassword(req, res, next) {
    try {
      const { token, newPassword, confirmPassword } = req.body;

      if (newPassword !== confirmPassword) {
        throw new AppError("Пароли не совпадают", 400);
      }

      // Находим пользователя по токену
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpires: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        throw new AppError(
          "Недействительная или просроченная ссылка для сброса пароля",
          400
        );
      }

      // Хешируем новый пароль
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Обновляем пароль и очищаем токены
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
        },
      });

      // Удаляем все сессии пользователя
      await prisma.session.deleteMany({
        where: { userId: user.id },
      });

      // Логируем сброс пароля
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "RESET_PASSWORD",
          entityType: "User",
          entityId: user.id,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });

      res.json({
        success: true,
        message: "Пароль успешно изменен",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { AuthController };
