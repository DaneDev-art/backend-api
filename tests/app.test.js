// tests/app.test.js
const request = require("supertest");
const app = require("../src/app");

describe("Health check", () => {
  it("GET /healthz doit répondre avec status ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });
});
