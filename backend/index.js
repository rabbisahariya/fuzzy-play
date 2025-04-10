const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Set up Express app
const app = express();
app.use(express.json());

// Telegram Bot setup (replace 'YOUR_BOT_TOKEN' with your actual bot token from BotFather)
const token = '7944961147:AAHZNBCOUfqDBRb6MXSFK-Yz0j0rpKv_O0Y'; // Replace this with your bot token
const bot = new TelegramBot(token, { polling: true });

// Add error handling for Telegram polling errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Create the db folder if it doesn't exist
const dbPath = path.join(__dirname, 'db');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath);
}

// Set up SQLite database
const db = new sqlite3.Database('./db/database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite');
  }
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    username TEXT,
    balance INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    reward INTEGER
  )`);
});

// Express routes
app.get('/', (req, res) => {
  res.send('Fuzzy Play Backend is running!');
});

// Example route for user data
app.get('/user/:userId', (req, res) => {
  const userId = req.params.userId;
  const username = req.query.username || 'Unknown';
  
  db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.json(row);
    } else {
      // Insert new user if not found
      db.run('INSERT INTO users (userId, username, balance) VALUES (?, ?, ?)', [userId, username, 0], (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ userId, username, balance: 0 });
      });
    }
  });
});

// Example route for quests
app.get('/quests', (req, res) => {
  db.all('SELECT * FROM quests', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Telegram bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to Fuzzy Play! Tap the menu to play.', {
    reply_markup: {
      keyboard: [[{ text: 'Play Fuzzy Play', web_app: { url: 'https://fuzzy-play-backend.onrender.com' } }]], // Replace with your Render URL
      resize_keyboard: true,
    },
  });
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});