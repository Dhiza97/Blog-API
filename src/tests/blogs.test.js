const request = require("supertest");
const app = require("../../server");
const { connect, closeDatabase, clearDatabase } = require("./setupTests");
jest.setTimeout(300000);

let token;
let userId;

beforeAll(async () => {
  await connect();
});
afterEach(async () => {
  await clearDatabase();
  token = undefined;
  userId = undefined;
});
afterAll(async () => {
  await closeDatabase();
});

async function createUserAndToken() {
  const res = await request(app).post("/api/auth/signup").send({
    first_name: "Alice",
    last_name: "Smith",
    email: "alice@example.com",
    password: "password123",
  });
  token = res.body.token;
  userId = res.body.user.id;
}

describe("Blogs", () => {
  test("create blog (draft) and publish, get increments read_count", async () => {
    await createUserAndToken();

    // create
    const createRes = await request(app)
      .post("/api/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "First Post",
        description: "A test post",
        tags: "test,first",
        body: "Hello world, this is a test post to check reading time calculation.",
      });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.state).toBe("draft");

    const blogId = createRes.body._id;

    // unauth user should NOT be able to get draft
    const getDraft = await request(app).get(`/api/blogs/${blogId}`);
    expect(getDraft.statusCode).toBe(403);

    // owner publishes
    const publishRes = await request(app)
      .patch(`/api/blogs/${blogId}/publish`)
      .set("Authorization", `Bearer ${token}`);
    expect(publishRes.statusCode).toBe(200);
    expect(publishRes.body.state).toBe("published");

    // get as public; read_count increments
    const firstGet = await request(app).get(`/api/blogs/${blogId}`);
    expect(firstGet.statusCode).toBe(200);
    expect(firstGet.body.read_count).toBe(1);

    // second get increments to 2
    const secondGet = await request(app).get(`/api/blogs/${blogId}`);
    expect(secondGet.body.read_count).toBe(2);
  });

  test("list blogs pagination, search, sort & owner list", async () => {
    await createUserAndToken();

    // create multiple blogs, publish some
    for (let i = 1; i <= 30; i++) {
      const res = await request(app)
        .post("/api/blogs")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: `Post ${i}`,
          description: `Desc ${i}`,
          tags: i % 2 === 0 ? "even" : "odd",
          body: `Body content ${i} `.repeat(i), // variable length
        });
      // publish half
      if (i <= 20) {
        await request(app)
          .patch(`/api/blogs/${res.body._id}/publish`)
          .set("Authorization", `Bearer ${token}`);
      }
    }

    // list default page (published only) should return 20 (we published 20)
    const listRes = await request(app).get("/api/blogs");
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.docs.length).toBe(20);
    expect(listRes.body.totalDocs).toBe(20);

    // page=2 (should be empty)
    const page2 = await request(app).get("/api/blogs?page=2");
    expect(page2.statusCode).toBe(200);
    expect(page2.body.docs.length).toBe(0);

    // search by tag
    const tagSearch = await request(app).get("/api/blogs?tags=even");
    expect(tagSearch.statusCode).toBe(200);
    // there should be about 10 even posts among the first 20 published
    expect(tagSearch.body.totalDocs).toBeGreaterThanOrEqual(9);

    // owner's blogs (should include drafts)
    const myList = await request(app)
      .get("/api/blogs/me/list")
      .set("Authorization", `Bearer ${token}`);
    expect(myList.statusCode).toBe(200);
    // user created 30 blogs in total
    expect(myList.body.totalDocs).toBe(30);

    // sort by reading_time ascending (example)
    const sorted = await request(app).get("/api/blogs?sort=reading_time");
    expect(sorted.statusCode).toBe(200);
  });

  test("owner can update & delete", async () => {
    await createUserAndToken();
    const createRes = await request(app)
      .post("/api/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Update Delete Post",
        description: "To update",
        tags: "update",
        body: "some body",
      });
    const id = createRes.body._id;

    const updateRes = await request(app)
      .put(`/api/blogs/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "updated body", title: "Update Delete Post" });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.body).toBe("updated body");

    const deleteRes = await request(app)
      .delete(`/api/blogs/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.statusCode).toBe(200);
  });
});