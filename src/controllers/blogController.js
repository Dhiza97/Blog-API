const Blog = require("../models/Blog");
const User = require("../models/User");
const { calculateReadingTime } = require("../utils/readingTime");
const paginate = require("../utils/paginate");
const mongoose = require("mongoose");

const allowedSortFields = ["read_count", "reading_time", "timestamp"];

// Create a new blog (draft by default)
exports.createBlog = async (req, res, next) => {
  try {
    const { title, description, tags, body } = req.body;
    if (!title || !body)
      return res.status(400).json({ message: "title and body are required" });

    const exists = await Blog.findOne({ title });
    if (exists)
      return res.status(409).json({ message: "Blog title must be unique" });

    const textForReading = [description || "", body].join(" ");
    const reading_time = calculateReadingTime(textForReading);

    const blog = new Blog({
      title,
      description,
      author: req.user._id,
      tags: Array.isArray(tags)
        ? tags
        : tags
        ? tags.split(",").map((t) => t.trim())
        : [],
      body,
      reading_time,
      state: "draft",
    });
    await blog.save();
    res.status(201).json(blog);
  } catch (err) {
    next(err);
  }
};

// Owner-only update
exports.updateBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    if (!blog.author.equals(req.user._id))
      return res.status(403).json({ message: "Forbidden" });

    // If title is being updated, ensure uniqueness
    if (updates.title && updates.title !== blog.title) {
      const other = await Blog.findOne({ title: updates.title });
      if (other) return res.status(409).json({ message: "Title already used" });
    }

    if (updates.body || updates.description) {
      const textForReading = [
        (updates.description !== undefined
          ? updates.description
          : blog.description) || "",
        updates.body !== undefined ? updates.body : blog.body,
      ].join(" ");
      updates.reading_time = calculateReadingTime(textForReading);
    }

    Object.assign(blog, updates);
    await blog.save();
    res.json(blog);
  } catch (err) {
    next(err);
  }
};

// Owner-only publish
exports.publishBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    if (!blog.author.equals(req.user._id))
      return res.status(403).json({ message: "Forbidden" });
    blog.state = "published";
    await blog.save();
    res.json(blog);
  } catch (err) {
    next(err);
  }
};

// Owner-only delete
exports.deleteBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    if (!blog.author.equals(req.user._id))
      return res.status(403).json({ message: "Forbidden" });
    await blog.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
};

// Get single blog by ID
exports.getBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid id" });

    // If blog exists and is published OR the requester is owner, return it and increment read_count
    const blog = await Blog.findByIdAndUpdate(
      id,
      { $inc: { read_count: 1 } },
      { new: true }
    ).populate("author", "first_name last_name email");

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    if (blog.state === "published") {
      return res.json(blog);
    }

    // draft: only owner can view
    const authHeader = req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(403).json({ message: "Forbidden" });

    // verify token locally
    const jwt = require("jsonwebtoken");
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    } catch (err) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (decoded.id !== String(blog.author._id))
      return res.status(403).json({ message: "Forbidden" });

    res.json(blog);
  } catch (err) {
    next(err);
  }
};

// List blogs with filters, pagination, sorting
exports.listBlogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      state,
      q,
      author,
      title,
      tags,
      sort,
    } = req.query;

    const {
      skip,
      limit: lim,
      page: currentPage,
    } = paginate({}, { page, limit });

    const filter = {};

    // Allow state filter; if omitted return published only.
    if (state) {
      filter.state = state;
    } else {
      filter.state = "published";
    }

    if (author) {
      if (mongoose.Types.ObjectId.isValid(author)) filter.author = author;
    }

    if (title) {
      filter.title = { $regex: title, $options: "i" };
    }

    if (tags) {
      const t = tags.split(",").map((s) => s.trim());
      filter.tags = { $in: t };
    }

    // general search (title, tags, author's name/email)
    let authorIdsFromSearch = null;
    if (q) {
      const qRegex = new RegExp(q, "i");
      // find matching authors
      const matchingUsers = await User.find({
        $or: [{ first_name: qRegex }, { last_name: qRegex }, { email: qRegex }],
      }).select("_id");

      authorIdsFromSearch = matchingUsers.map((u) => u._id);

      filter.$or = [
        { title: qRegex },
        { tags: qRegex },
        { author: { $in: authorIdsFromSearch } },
      ];
    }

    // Sorting
    let sortQuery = { timestamp: -1 };
    if (sort) {
      const field = sort.replace("-", "");
      const order = sort.startsWith("-") ? -1 : 1;
      if (allowedSortFields.includes(field)) {
        sortQuery = { [field]: order };
      }
    }

    const [docs, totalDocs] = await Promise.all([
      Blog.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(lim)
        .populate("author", "first_name last_name email"),
      Blog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalDocs / lim);
    res.json({
      docs,
      totalDocs,
      limit: lim,
      page: currentPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    });
  } catch (err) {
    next(err);
  }
};

// List blogs of the authenticated user (owner), with pagination, sorting, state filter
exports.myBlogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, state, sort } = req.query;
    const {
      skip,
      limit: lim,
      page: currentPage,
    } = paginate({}, { page, limit });
    const filter = { author: req.user._id };
    if (state) filter.state = state;

    let sortQuery = { timestamp: -1 };
    if (sort) {
      const field = sort.replace("-", "");
      const order = sort.startsWith("-") ? -1 : 1;
      if (allowedSortFields.includes(field)) {
        sortQuery = { [field]: order };
      }
    }

    const [docs, totalDocs] = await Promise.all([
      Blog.find(filter).sort(sortQuery).skip(skip).limit(lim),
      Blog.countDocuments(filter),
    ]);

    res.json({
      docs,
      totalDocs,
      limit: lim,
      page: currentPage,
      totalPages: Math.ceil(totalDocs / lim),
      hasNextPage: currentPage < Math.ceil(totalDocs / lim),
      hasPrevPage: currentPage > 1,
    });
  } catch (err) {
    next(err);
  }
};