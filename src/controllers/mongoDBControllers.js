// MONGOOSE MONGODB
const mongoose = require('mongoose');

const CarsSchema = new mongoose.Schema({
    model: String,
    year: Number,
    price: Number,
});

const CarsModel = mongoose.model('turners-cars', CarsSchema);

const fetchTurnersCarsList = async () => {
    await mongoose.connect('mongodb://localhost:27017/turnersDB');
    mongoose.connection.on('error', err => console.error('MONGOOSE ERROR :::', err));
    const turnersDB = await CarsModel.find({});
    mongoose.connection.close();
    return turnersDB;
};

module.exports = fetchTurnersCarsList;
