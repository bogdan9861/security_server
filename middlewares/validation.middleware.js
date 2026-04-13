import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Ошибка валидации",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};

export const validatePatient = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { firstName, lastName, birthDate, phone } = req.body;
  const errors: string[] = [];

  if (!firstName || firstName.length < 2) {
    errors.push("Имя должно содержать минимум 2 символа");
  }
  if (!lastName || lastName.length < 2) {
    errors.push("Фамилия должна содержать минимум 2 символа");
  }
  if (birthDate && isNaN(Date.parse(birthDate))) {
    errors.push("Неверный формат даты рождения");
  }
  if (phone && !/^\+?[0-9\s\-\(\)]{10,15}$/.test(phone)) {
    errors.push("Неверный формат телефона");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Ошибка валидации",
      errors,
    });
  }

  next();
};
