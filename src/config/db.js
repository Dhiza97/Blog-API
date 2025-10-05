const mongoose = require('mongoose');

const connectDB = async () => {

    mongoose.connection.on('connected', () => {
        console.log('E don Connect!');
    });

    await mongoose.connect(`${process.env.MONGO_URI}/blog-api`);
}

module.exports = connectDB;