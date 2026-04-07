const express = require('express');
const path = require('path');
const { initDB } = require('./db/schema');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Mount routes
app.use('/api', require('./routes/applications'));
app.use('/api', require('./routes/profile'));
app.use('/api', require('./routes/templates'));
app.use('/api', require('./routes/search'));
app.use('/api', require('./routes/automation'));
app.use('/api', require('./routes/stats'));
app.use('/api', require('./routes/prep'));
app.use('/api', require('./routes/ai'));

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3456;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log('Job Hunt Pro running at http://localhost:' + PORT);
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
