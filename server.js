const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const MONGO_URI = 'mongodb://localhost:27017/transactionsDB';
const THIRD_PARTY_API_URL = 'https://s3.amazonaws.com/roxiler.com/product_transaction.json';

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

const transactionSchema = new mongoose.Schema({
    transaction_id: String,
    product_id: String,
    title: String,
    description: String,
    quantity: Number,
    price: Number,
    dateOfSale: Date,
    category: String,
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Initialize Database
app.get('/init_db', async (req, res) => {
    try {
        const response = await axios.get(THIRD_PARTY_API_URL);
        const data = response.data;

        await Transaction.deleteMany({});
        await Transaction.insertMany(data);

        res.status(200).json({ message: 'Database initialized successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Other APIs will go here...

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


// List Transactions with Search and Pagination
app.get('/transactions', async (req, res) => {
    const { page = 1, per_page = 10, search = '', month } = req.query;
    const limit = parseInt(per_page);
    const skip = (page - 1) * limit;

    try {
        const regex = new RegExp(search, 'i');
        const query = {
            dateOfSale: { $regex: `^${month}`, $options: 'i' },
            $or: [
                { title: regex },
                { description: regex },
                { price: regex }
            ]
        };

        const transactions = await Transaction.find(query).skip(skip).limit(limit);
        const total = await Transaction.countDocuments(query);

        res.status(200).json({ transactions, total, page, per_page: limit });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Statistics API
app.get('/statistics', async (req, res) => {
    const { month } = req.query;

    try {
        const sales = await Transaction.find({ dateOfSale: { $regex: `^${month}`, $options: 'i' } });

        const totalSalesAmount = sales.reduce((acc, sale) => acc + sale.price * sale.quantity, 0);
        const totalSoldItems = sales.reduce((acc, sale) => acc + sale.quantity, 0);
        const totalNotSoldItems = sales.length - totalSoldItems;

        res.status(200).json({
            totalSalesAmount,
            totalSoldItems,
            totalNotSoldItems
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Bar Chart API
app.get('/bar_chart', async (req, res) => {
    const { month } = req.query;

    try {
        const sales = await Transaction.find({ dateOfSale: { $regex: `^${month}`, $options: 'i' } });

        const priceRanges = {
            '0-100': 0,
            '101-200': 0,
            '201-300': 0,
            '301-400': 0,
            '401-500': 0,
            '501-600': 0,
            '601-700': 0,
            '701-800': 0,
            '801-900': 0,
            '901-above': 0
        };

        sales.forEach(sale => {
            if (sale.price <= 100) priceRanges['0-100']++;
            else if (sale.price <= 200) priceRanges['101-200']++;
            else if (sale.price <= 300) priceRanges['201-300']++;
            else if (sale.price <= 400) priceRanges['301-400']++;
            else if (sale.price <= 500) priceRanges['401-500']++;
            else if (sale.price <= 600) priceRanges['501-600']++;
            else if (sale.price <= 700) priceRanges['601-700']++;
            else if (sale.price <= 800) priceRanges['701-800']++;
            else if (sale.price <= 900) priceRanges['801-900']++;
            else priceRanges['901-above']++;
        });

        res.status(200).json(priceRanges);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Pie Chart API
app.get('/pie_chart', async (req, res) => {
    const { month } = req.query;

    try {
        const sales = await Transaction.find({ dateOfSale: { $regex: `^${month}`, $options: 'i' } });

        const categories = {};

        sales.forEach(sale => {
            if (categories[sale.category]) {
                categories[sale.category]++;
            } else {
                categories[sale.category] = 1;
            }
        });

        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Combined Data API
app.get('/combined_data', async (req, res) => {
    const { month } = req.query;

    try {
        const [statistics, barChart, pieChart] = await Promise.all([
            axios.get(`http://localhost:${PORT}/statistics`, { params: { month } }),
            axios.get(`http://localhost:${PORT}/bar_chart`, { params: { month } }),
            axios.get(`http://localhost:${PORT}/pie_chart`, { params: { month } })
        ]);

        res.status(200).json({
            statistics: statistics.data,
            barChart: barChart.data,
            pieChart: pieChart.data
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
