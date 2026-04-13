const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient();

/**
 * Middleware для проверки JWT токена и получения пользователя
 */
const authenticateToken = async (req, res, next) => {
  try {
    // 1. Получаем токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Токен не предоставлен",
      });
    }

    // 2. Верифицируем токен
    const jwtSecret = process.env.JWT_SECRET || "secret-key";
    let decoded;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: "Недействительный или просроченный токен",
      });
    }

    // 3. Проверяем существование сессии в БД
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      include: {
        user: {
          include: {
            doctorProfile: true,
            registratorProfile: true,
            patients: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Сессия не найдена",
      });
    }

    // 4. Проверяем не истекла ли сессия
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      return res.status(401).json({
        success: false,
        message: "Сессия истекла",
      });
    }

    // 5. Проверяем активен ли пользователь
    if (!session.user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Учетная запись деактивирована",
      });
    }

    // 6. Сохраняем информацию о пользователе в req
    req.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      doctorId: session.user.doctorProfile?.id,
      registratorId: session.user.registratorProfile?.id,
      patientId: session.user.patients?.[0]?.id,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Внутренняя ошибка сервера",
    });
  }
};

/**
 * Middleware для проверки ролей
 */
const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Не авторизован",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Доступ запрещен. Недостаточно прав",
      });
    }

    next();
  };
};

/**
 * Опциональная аутентификация
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      const jwtSecret = process.env.JWT_SECRET || "secret-key";
      const decoded = jwt.verify(token, jwtSecret);

      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
        include: {
          user: {
            include: {
              doctorProfile: true,
              registratorProfile: true,
              patients: true,
            },
          },
        },
      });

      if (session && session.expiresAt > new Date() && session.user.isActive) {
        req.user = {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
          doctorId: session.user.doctorProfile?.id,
          registratorId: session.user.registratorProfile?.id,
          patient: session.user.patients[0],
        };
      }
    }
    next();
  } catch (error) {
    next();
  }
};

module.exports = { authenticateToken, requireRoles, optionalAuth };
