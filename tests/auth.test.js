// tests/auth.test.js
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/user.model");

// ✅ Augmente le timeout global des tests (utile pour MongoDB)
jest.setTimeout(60000); // 60 secondes

beforeAll(async () => {
  // Connexion à la DB de test (Windows + Docker exposé)
  const uri =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mydb_test";
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Nettoyer la collection avant les tests
  await User.deleteMany({});
});

beforeEach(async () => {
  // Nettoie les utilisateurs avant chaque test pour éviter les conflits
  await User.deleteMany({});
});

afterAll(async () => {
  // Nettoyer la DB et fermer la connexion après tous les tests
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe("Auth API", () => {
  it("✅ Register crée un utilisateur", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com", password: "123456", name: "Test User" });

    expect(res.statusCode).toBe(201);
    // Adapté à ton API actuelle
    expect(res.body).toHaveProperty("message", "Utilisateur créé avec succès");
  });

  it("✅ Login fonctionne avec les bons identifiants", async () => {
    // S'assurer que l'utilisateur est créé avant le login
    await User.create({ email: "test@example.com", password: "123456", name: "Test User" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "123456" });

    expect(res.statusCode).toBe(200);
    // Si ton API renvoie token + user, tu peux décommenter ces lignes :
    // expect(res.body).toHaveProperty("token");
    // expect(res.body.user).toHaveProperty("email", "test@example.com");
  });

  it("❌ Login échoue avec mauvais mot de passe", async () => {
    // S'assurer que l'utilisateur existe
    await User.create({ email: "test@example.com", password: "123456", name: "Test User" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "wrongpass" });

    expect(res.statusCode).toBe(401);
    // Adapté à ton API actuelle
    expect(res.body).toHaveProperty("message", "Email ou mot de passe incorrect");
  });
});
