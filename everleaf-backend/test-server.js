const express = require('express');
const app = express();

app.get('/test', (req, res) => {
  res.json({ message: 'Simple test working' });
});

app.listen(5000, () => {
  console.log('Test server running on port 5000');
});