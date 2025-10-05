require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoute');
const blogRoutes = require('./src/routes/blogRoute');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
app.use(bodyParser.json());

// Connect to the database if not running tests
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Middleware to parse JSON requests
app.use(express.json());

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);

app.use(errorHandler);


// Define a simple route
app.get('/', (req, res) => {
    res.send('Welcome to the Blog API');
});

const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;