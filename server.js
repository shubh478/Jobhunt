const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { initDB } = require('./db/schema');
const { attachUser } = require('./lib/auth');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(attachUser);
app.use(express.static(path.join(__dirname, 'public')));

// Mount routes
app.use('/api', require('./routes/auth'));
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
  console.log('DB connected successfully');
}).catch(err => {
  console.error('DB init failed:', err.message);
  console.log('Server will start anyway - DB features may not work');
}).finally(() => {
  app.listen(PORT, () => {
    console.log('Job Hunt Pro running at http://localhost:' + PORT);
  });
});
