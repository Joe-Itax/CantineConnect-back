async function paginationQuery(model, page = 1, limit = 10, select = null) {
  page = Math.max(1, parseInt(page) || 1); // Assurer un min à 1
  limit = Math.max(1, parseInt(limit) || 10);
  const skip = (page - 1) * limit;

  //Récupération du nombre total d'éléments
  const totalItems = await model.count();
  const totalPages = Math.ceil(totalItems / limit);

  // Vérifier si la page demandée est valide
  if (page > totalPages && totalItems > 0) {
    return {
      error: `La page ${page} n'existe pas. Dernière page disponible : ${totalPages}.`,
      totalPages,
      limitPerPage: limit,
      currentPage: page,
      totalItems,
      data: [],
    };
  }

  //Récupération des éléments paginés
  const queryOptions = { skip, take: limit };
  if (select) queryOptions.select = select;

  const data = await model.findMany(queryOptions);

  return {
    totalPages,
    limitPerPage: limit,
    currentPage: page,
    totalItems,
    data,
  };
}

module.exports = paginationQuery;
