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

// Auth routes are public
app.use('/api', require('./routes/auth'));

// All other /api routes require login. Search is read-only & profile-aware so it stays public.
app.use('/api', require('./routes/search'));
app.use('/api', (req, res, next) => {
  if (!req.userId) return res.status(401).json({ error: 'Login required' });
  next();
});

app.use('/api', require('./routes/applications'));
app.use('/api', require('./routes/profile'));
app.use('/api', require('./routes/import'));
app.use('/api', require('./routes/templates'));
app.use('/api', require('./routes/automation'));
app.use('/api', require('./routes/stats'));
app.use('/api', require('./routes/prep'));
app.use('/api', require('./routes/ai'));

// Serve frontend — redirect to /login.html if not logged in
app.get('/', (req, res) => {
  if (!req.userId) return res.redirect('/login.html');
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
