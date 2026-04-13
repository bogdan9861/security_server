const { Prisma } = require('@prisma/client');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  // Логирование ошибки
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    user: req.user,
  });

  // Обработка Prisma ошибок
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({
          success: false,
          message: `Запись с таким значением уже существует`,
          field: err.meta?.target?.join(', '),
        });
      case 'P2014':
        return res.status(400).json({
          success: false,
          message: 'Нарушение целостности данных',
        });
      case 'P2003':
        return res.status(400).json({
          success: false,
          message: 'Связанная запись не найдена',
        });
      case 'P2025':
        return res.status(404).json({
          success: false,
          message: 'Запись не найдена',
        });
      default:
        return res.status(500).json({
          success: false,
          message: 'Ошибка базы данных',
        });
    }
  }

  // Обработка кастомных ошибок
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Неизвестные ошибки
  return res.status(500).json({
    success: false,
    message: 'Внутренняя ошибка сервера',
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Маршрут ${req.method} ${req.url} не найден`,
  });
};

module.exports = { AppError, errorHandler, notFound };