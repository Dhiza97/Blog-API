const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const auth = require('../middleware/auth');

// public listing of published blogs (and filterable by state if caller passes state param)
router.get('/', blogController.listBlogs);

// get a single blog (published sees anyone; draft only owner)
router.get('/:id', blogController.getBlog);

// owner-only: list my blogs
router.get('/me/list', auth, blogController.myBlogs);

// owner-only create
router.post('/', auth, blogController.createBlog);

// owner-only update
router.put('/:id', auth, blogController.updateBlog);

// owner-only publish (could also be done via update with state)
router.patch('/:id/publish', auth, blogController.publishBlog);

// owner-only delete
router.delete('/:id', auth, blogController.deleteBlog);

module.exports = router;