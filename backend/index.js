const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Set up Express app
const app = express();
app.use(express.json());

// Serve the app folder as static files
app.use(express.static(path.join(__dirname, '../app')));

// Serve the admin folder as static files
app.use('/admin', express.static(path.join(__dirname, '../admin'), (req, res, next) => {
  console.log('Serving static file from admin folder:', req.url);
  next();
}));

// Telegram Bot setup
const token = '7944961147:AAHZNBCOUfqDBRb6MXSFK-Yz0j0rpKv_O0Y';
let bot;
try {
  bot = new TelegramBot(token, { polling: true });
  console.log('Telegram bot initialized successfully.');
} catch (error) {
  console.error('ERROR: Failed to initialize Telegram bot:', error.message);
  process.exit(1);
}

// Add error handling for Telegram polling errors
bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error.message);
  if (error.message.includes('409 Conflict')) {
    console.error('Multiple bot instances detected. Stopping polling to prevent conflicts.');
    bot.stopPolling().then(() => {
      console.log('Polling stopped. Please ensure only one instance of the bot is running.');
    });
  }
});

// Create the db folder if it doesn't exist
const dbPath = path.join(__dirname, 'db');
const dbFilePath = path.join(dbPath, 'database.sqlite');

try {
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
    console.log('Created db folder at:', dbPath);
  } else {
    console.log('db folder already exists at:', dbPath);
  }
} catch (error) {
  console.error('ERROR: Failed to create db folder:', error.message);
  process.exit(1);
}

// Set up SQLite database
let db;
try {
  db = new sqlite3.Database(dbFilePath, (err) => {
    if (err) {
      console.error('ERROR: Failed to open SQLite database:', err.message);
      process.exit(1);
    } else {
      console.log('Connected to SQLite database at:', dbFilePath);
    }
  });
} catch (error) {
  console.error('ERROR: Failed to initialize SQLite database:', error.message);
  process.exit(1);
}

// Create tables if they don't exist
try {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      userId TEXT PRIMARY KEY,
      username TEXT,
      balance INTEGER DEFAULT 0
    )`, (err) => {
      if (err) {
        console.error('ERROR: Failed to create users table:', err.message);
      } else {
        console.log('Users table created or already exists.');
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      reward INTEGER
    )`, (err) => {
      if (err) {
        console.error('ERROR: Failed to create quests table:', err.message);
      } else {
        console.log('Quests table created or already exists.');
      }
    });

    // Add sample quests if the table is empty
    db.get('SELECT COUNT(*) as count FROM quests', (err, row) => {
      if (err) {
        console.error('ERROR: Failed to check quests table:', err.message);
        return;
      }
      if (row.count === 0) {
        const sampleQuests = [
          { title: 'First Quest', description: 'Complete your first task', reward: 100 },
          { title: 'Invite a Friend', description: 'Invite a friend to join', reward: 50 }
        ];
        sampleQuests.forEach(quest => {
          db.run('INSERT INTO quests (title, description, reward) VALUES (?, ?, ?)', 
            [quest.title, quest.description, quest.reward], 
            (err) => {
              if (err) {
                console.error('ERROR: Failed to insert sample quest:', err.message);
              } else {
                console.log(`Sample quest added: ${quest.title}`);
              }
            });
        });
      } else {
        console.log('Quests table already contains data.');
      }
    });
  });
} catch (error) {
  console.error('ERROR: Failed to create database tables:', error.message);
  process.exit(1);
}

// Express routes
app.get('/', (req, res) => {
  res.send('Fuzzy Play Backend is running!');
});

// Serve the admin panel
app.get('/admin', (req, res) => {
  console.log('Admin panel route accessed');
  const adminIndexPath = path.join(__dirname, '../admin/index.html');
  if (fs.existsSync(adminIndexPath)) {
    res.sendFile(adminIndexPath);
  } else {
    console.error('ERROR: admin/index.html not found at:', adminIndexPath);
    res.status(404).send('Admin panel not found');
  }
});

// Route for user data
app.get('/user/:userId', (req, res) => {
  const userId = req.params.userId;
  const username = req.query.username || 'Unknown';
  
  db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
    if (err) {
      console.error('ERROR: Failed to fetch user:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.json(row);
    } else {
      db.run('INSERT INTO users (userId, username, balance) VALUES (?, ?, ?)', [userId, username, 0], (err) => {
        if (err) {
          console.error('ERROR: Failed to insert new user:', err.message);
          res.status(500).json({ error: err.message });
          return;
        }
        console.log(`New user added: ${userId} (${username})`);
        res.json({ userId, username, balance: 0 });
      });
    }
  });
});

// Route for quests
app.get('/quests', (req, res) => {
  db.all('SELECT * FROM quests', [], (err, rows) => {
    if (err) {
      console.error('ERROR: Failed to fetch quests:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Telegram bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to Fuzzy Play! Tap the button below to play.', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Play Fuzzy Play',
            web_app: { url: 'https://fuzzy-play-backend.onrender.com' }
          }
        ]
      ]
    }
  }).catch(error => {
    console.error('ERROR: Failed to send /start message:', error.message);
  });
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  bot.stopPolling().then(() => {
    console.log('Telegram bot polling stopped.');
    db.close((err) => {
      if (err) {
        console.error('ERROR: Failed to close database:', err.message);
      } else {
        console.log('Database connection closed.');
      }
      process.exit(0);
    });
  });
});