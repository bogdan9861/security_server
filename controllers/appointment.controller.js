const { PrismaClient, VisitStatus } = require("@prisma/client");
const { AppError } = require("../middlewares/error.middleware");

const prisma = new PrismaClient();

class AppointmentController {
  /**
   * Получить все записи на приём
   */
  static async getAll(req, res, next) {
    try {
      const { date, doctorId, status, patientId, fromDate, toDate } = req.query;

      const where = {};

      if (doctorId) where.doctorId = Number(doctorId);
      if (patientId) where.patientId = Number(patientId);
      if (status) where.status = status;

      // Фильтр по дате
      if (date) {
        const startDate = new Date(String(date));
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(String(date));
        endDate.setHours(23, 59, 59, 999);
        where.appointmentTime = { gte: startDate, lte: endDate };
      } else if (fromDate || toDate) {
        where.appointmentTime = {};
        if (fromDate) where.appointmentTime.gte = new Date(String(fromDate));
        if (toDate) where.appointmentTime.lte = new Date(String(toDate));
      }

      const appointments = await prisma.appointment.findMany({
        where,
        include: {
          patient: true,
          doctor: {
            include: { user: true },
          },
          registrator: {
            include: { user: true },
          },
          visit: true,
        },
        orderBy: { appointmentTime: "asc" },
      });

      res.json({
        success: true,
        data: appointments,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMine(req, res, next) {
    const { date, doctorId, status, fromDate, toDate } = req.query;

    const where = {};

    if (doctorId) where.doctorId = Number(doctorId);

    if (status) where.status = status;

    // Фильтр по дате
    if (date) {
      const startDate = new Date(String(date));
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(String(date));
      endDate.setHours(23, 59, 59, 999);
      where.appointmentTime = { gte: startDate, lte: endDate };
    } else if (fromDate || toDate) {
      where.appointmentTime = {};
      if (fromDate) where.appointmentTime.gte = new Date(String(fromDate));
      if (toDate) where.appointmentTime.lte = new Date(String(toDate));
    }

    where.patientId = req.user.patientId;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: {
          include: { user: true },
        },
        registrator: {
          include: { user: true },
        },
        visit: true,
      },
      orderBy: { appointmentTime: "asc" },
    });

    res.json({
      success: true,
      data: appointments,
    });
  }

  /**
   * Создать запись на приём
   */
  static async create(req, res, next) {
    try {
      const {
        patientId,
        doctorId,
        appointmentTime,
        durationMinutes,
        type,
        paymentType,
        notes,
      } = req.body;

      // Проверяем, свободен ли врач в это время
      const appointmentEnd = new Date(appointmentTime);
      appointmentEnd.setMinutes(appointmentEnd.getMinutes() + durationMinutes);

      const conflictingAppointment = await prisma.appointment.findFirst({
        where: {
          doctorId,
          appointmentTime: {
            lt: appointmentEnd,
            gte: new Date(appointmentTime),
          },
          status: { not: "CANCELLED" },
        },
      });

      if (conflictingAppointment) {
        throw new AppError("Врач уже занят в это время", 409);
      }

      // Создаём запись
      const appointment = await prisma.appointment.create({
        data: {
          patientId,
          doctorId,
          registratorId: req.user?.registratorId,
          appointmentTime: new Date(appointmentTime),
          durationMinutes,
          type,
          paymentType,
          notes,
          status: VisitStatus.SCHEDULED,
        },
        include: {
          patient: true,
          doctor: {
            include: { user: true },
          },
        },
      });

      // Логируем
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "CREATE",
            entityType: "Appointment",
            entityId: appointment.id,
            newValues: appointment,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        });
      }

      res.status(201).json({
        success: true,
        data: appointment,
        message: "Запись создана успешно",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отменить запись
   */
  static async cancel(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const appointment = await prisma.appointment.update({
        where: { id: Number(id) },
        data: {
          status: VisitStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });

      res.json({
        success: true,
        data: appointment,
        message: "Запись отменена",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить свободные слоты врача на день
   */
  static async getAvailableSlots(req, res, next) {
    try {
      const { doctorId, date } = req.query;
      const workStart = 9; // 9:00
      const workEnd = 18; // 18:00
      const slotDuration = 15; // 15 минут

      const selectedDate = new Date(String(date));
      selectedDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);

      // Получаем занятые слоты
      const busySlots = await prisma.appointment.findMany({
        where: {
          doctorId: Number(doctorId),
          appointmentTime: {
            gte: selectedDate,
            lt: nextDate,
          },
          status: { not: "CANCELLED" },
        },
      });

      // Генерируем все возможные слоты
      const slots = [];
      for (let hour = workStart; hour < workEnd; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const slotTime = new Date(selectedDate);
          slotTime.setHours(hour, minute, 0, 0);

          if (slotTime > new Date()) {
            const isBusy = busySlots.some(
              (busy) => busy.appointmentTime.getTime() === slotTime.getTime()
            );

            slots.push({
              time: slotTime,
              available: !isBusy,
            });
          }
        }
      }

      res.json({
        success: true,
        data: slots,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { AppointmentController };
