const request = require("supertest");
const app = require("../../server");
const { connect, closeDatabase, clearDatabase } = require("./setupTests");
jest.setTimeout(300000);

beforeAll(async () => {
  await connect();
});
afterEach(async () => {
  await clearDatabase();
});
afterAll(async () => {
  await closeDatabase();
});

describe("Auth", () => {
  test("signup and signin", async () => {
    const signUpRes = await request(app).post("/api/auth/signup").send({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      password: "password123",
    });
    expect(signUpRes.statusCode).toBe(201);
    expect(signUpRes.body.token).toBeDefined();

    const signInRes = await request(app).post("/api/auth/signin").send({
      email: "john@example.com",
      password: "password123",
    });
    expect(signInRes.statusCode).toBe(200);
    expect(signInRes.body.token).toBeDefined();
  });

  test("signup duplicate email fails", async () => {
    await request(app).post("/api/auth/signup").send({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      password: "password123",
    });
    const res2 = await request(app).post("/api/auth/signup").send({
      first_name: "Jane",
      last_name: "Doe",
      email: "john@example.com",
      password: "password456",
    });
    expect(res2.statusCode).toBe(409);
  });
});