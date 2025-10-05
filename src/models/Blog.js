const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    state: { type: String, enum: ["draft", "published"], default: "draft" },
    read_count: { type: Number, default: 0 },
    reading_time: { type: Number, default: 1 },
    tags: [{ type: String, trim: true }],
    body: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Blog = mongoose.model.todo || mongoose.model("Blog", blogSchema);

module.exports = Blog;