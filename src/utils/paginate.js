function paginate(query, { page = 1, limit = 20 }) {
  page = Math.max(Number(page) || 1, 1);
  limit = Math.max(Number(limit) || 20, 1);
  const skip = (page - 1) * limit;
  return { skip, limit, page };
}

module.exports = paginate;