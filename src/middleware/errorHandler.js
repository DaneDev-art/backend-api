// ==========================================
// src/middleware/errorHandler.js
// Middleware global de gestion d'erreurs
// ==========================================

/**
 * Middleware central pour gérer toutes les erreurs
 * dans l'application Express.
 *
 * Usage : ajouter à la fin de toutes les routes
 * app.use(errorHandler);
 */

function errorHandler(err, req, res, next) {
  console.error("❌ [Global Error Handler]", err);

  // Si l'erreur contient un statusCode personnalisé
  const statusCode = err.statusCode || 500;

  // Message d'erreur pour l'utilisateur
  const message = err.message || "Erreur serveur interne.";

  // Optionnel : détails techniques (uniquement en dev)
  const stack = process.env.NODE_ENV === "development" ? err.stack : undefined;

  res.status(statusCode).json({
    error: true,
    message,
    ...(stack && { stack }),
  });
}

module.exports = errorHandler;
