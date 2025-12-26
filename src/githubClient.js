// src/githubClient.js
require("dotenv").config();
const { Octokit } = require("@octokit/rest");
const { createAppAuth } = require("@octokit/auth-app");

function getGithubClient() {
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID,
      privateKey: process.env.GITHUB_PRIVATE_KEY,
      installationId: process.env.GITHUB_INSTALLATION_ID,
    },
  });

  return octokit;
}

module.exports = { getGithubClient };
