const { prisma } = require("../prisma/prisma.client");

const getCategories = async (req, res) => {
  const categories = await prisma.category.findMany();
  res.json(categories);
};

const createCategory = async (req, res) => {
  const { name, description } = req.body;

  const category = await prisma.category.create({
    data: { name, description },
  });

  res.status(201).json(category);
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;

  await prisma.category.delete({ where: { id } });
  res.sendStatus(204);
};

module.exports = {
  getCategories,
  createCategory,
  deleteCategory,
};
