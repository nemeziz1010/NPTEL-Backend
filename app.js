const express = require('express');
const cors = require('cors');
const scraperRoute = require('./routes/scraperRoutes');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json()); // Allows reading JSON from POST requests
app.get('/', (req, res) => {
    res.send('Hello World!')
  })
app.use('/api', scraperRoute); // All routes prefixed with /api

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
