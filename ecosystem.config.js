module.exports = {
  apps: [
    {
      name: "myapp",
      script: "src/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
