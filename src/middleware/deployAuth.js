module.exports = function deployAuth(req, res, next) {
  const secret = req.headers["x-deploy-secret"];

  if (!secret || secret !== process.env.GITHUB_DEPLOY_SECRET) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  next();
};
