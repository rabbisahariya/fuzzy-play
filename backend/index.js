const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const serveStatic = require('serve-static');
const app = express();

// Middleware
app.use(express.json());
app.use('/app', serveStatic(path.join(__dirname, '../app')));
app.use('/admin', serveStatic(path.join(__dirname, '../admin')));

// Telegram Bot Setup
const token = '7671329449:AAHAtN4Wf9ZvLUc5xaAFcura_OIRMb8H2aA';
const bot = new TelegramBot(token, { polling: true });

// SQLite Database Setup
const db = new sqlite3.Database('./db/database.sqlite', (err) => {
    if (err) console.error('Database error:', err);
    console.log('Connected to SQLite database');
});

// Create Tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        username TEXT,
        tonBalance REAL DEFAULT 10,
        fzyBalance REAL DEFAULT 0,
        invitations INTEGER DEFAULT 0,
        questsCompleted INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS quests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        actionLink TEXT,
        reward REAL,
        tokenType TEXT,
        timer INTEGER,
        tonPayment REAL DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS completed_quests (
        userId TEXT,
        questId INTEGER,
        PRIMARY KEY (userId, questId)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('externalTonMin', '1')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('externalTonFee', '0.1')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('externalFzyMin', '10')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('externalFzyFee', '1')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('internalTonMin', '0.5')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('internalTonFee', '0.05')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('internalFzyMin', '5')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('internalFzyFee', '0.5')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('inviteRewardAmount', '1')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('inviteRewardToken', 'TON')`);

    const quests = [
        { name: 'Join Telegram Channel', actionLink: 'https://t.me/channel', reward: 5, tokenType: 'FZY', timer: 30, tonPayment: 0 },
        { name: 'Follow on X', actionLink: 'https://x.com/user', reward: 2, tokenType: 'TON', timer: 60, tonPayment: 0 },
        { name: 'Subscribe on YouTube', actionLink: 'https://youtube.com/channel', reward: 10, tokenType: 'FZY', timer: 45, tonPayment: 0 },
        { name: 'Premium Quest', actionLink: 'https://example.com', reward: 20, tokenType: 'TON', timer: 30, tonPayment: 0.5 }
    ];
    quests.forEach(quest => {
        db.run('INSERT OR IGNORE INTO quests (name, actionLink, reward, tokenType, timer, tonPayment) VALUES (?, ?, ?, ?, ?, ?)',
            [quest.name, quest.actionLink, quest.reward, quest.tokenType, quest.timer, quest.tonPayment]);
    });
});

// Telegram Bot - Handle /start command for invites
bot.onText(/\/start (.+)/, (msg, match) => {
    const referrerId = match[1];
    const userId = msg.from.id.toString();
    const username = msg.from.username || msg.from.first_name;

    db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
        if (!user) {
            db.run('INSERT INTO users (userId, username, tonBalance, fzyBalance, invitations) VALUES (?, ?, ?, ?, ?)',
                [userId, username, 10, 0, 0]);
            if (referrerId !== userId) {
                db.get('SELECT * FROM users WHERE userId = ?', [referrerId], (err, referrer) => {
                    if (referrer) {
                        db.get('SELECT * FROM settings WHERE key IN ("inviteRewardAmount", "inviteRewardToken")', (err, rows) => {
                            const settings = {};
                            rows.forEach(row => settings[row.key] = row.value);
                            const rewardAmount = parseFloat(settings.inviteRewardAmount);
                            const tokenField = settings.inviteRewardToken === 'TON' ? 'tonBalance' : 'fzyBalance';
                            db.run(`UPDATE users SET invitations = invitations + 1, ${tokenField} = ${tokenField} + ? WHERE userId = ?`,
                                [rewardAmount, referrerId]);
                        });
                    }
                });
            }
        }
    });

    bot.sendMessage(msg.chat.id, 'Welcome to Fuzzy Play! Click the menu button to start earning.');
});

// API Endpoints
app.get('/user/:userId', (req, res) => {
    const { userId } = req.params;
    const { username } = req.query;
    db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) {
            db.run('INSERT INTO users (userId, username, tonBalance, fzyBalance, invitations, questsCompleted) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, username || 'Unknown', 10, 0, 0, 0]);
            return res.json({ tonBalance: 10, fzyBalance: 0, invitations: 0, questsCompleted: 0, username: username || 'Unknown' });
        }
        res.json(user);
    });
});

app.get('/users', (req, res) => {
    db.all('SELECT * FROM users', [], (err, users) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(users);
    });
});

app.get('/quests', (req, res) => {
    db.all('SELECT * FROM quests', [], (err, quests) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(quests);
    });
});

app.get('/quest/:questId', (req, res) => {
    const { questId } = req.params;
    db.get('SELECT * FROM quests WHERE id = ?', [questId], (err, quest) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(quest);
    });
});

app.get('/check-quest/:userId/:questId', (req, res) => {
    const { userId, questId } = req.params;
    db.get('SELECT * FROM completed_quests WHERE userId = ? AND questId = ?', [userId, questId], (err, row) => {
        res.json({ completed: !!row });
    });
});

app.post('/add-quest', (req, res) => {
    const { name, actionLink, reward, tokenType, timer, tonPayment } = req.body;
    db.run('INSERT INTO quests (name, actionLink, reward, tokenType, timer, tonPayment) VALUES (?, ?, ?, ?, ?, ?)',
        [name, actionLink, reward, tokenType, timer, tonPayment], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Quest added successfully!' });
        });
});

app.post('/remove-quest', (req, res) => {
    const { questId } = req.body;
    db.run('DELETE FROM quests WHERE id = ?', [questId], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Quest removed successfully!' });
    });
});

app.post('/complete-ton-payment', (req, res) => {
    const { userId, questId, amount } = req.body;
    db.get('SELECT tonBalance FROM users WHERE userId = ?', [userId], (err, user) => {
        if (user.tonBalance < amount) {
            return res.json({ success: false, message: 'Insufficient TON balance' });
        }
        db.run('UPDATE users SET tonBalance = tonBalance - ? WHERE userId = ?', [amount, userId]);
        res.json({ success: true });
    });
});

app.post('/claim-reward', (req, res) => {
    const { userId, questId } = req.body;
    db.get('SELECT * FROM completed_quests WHERE userId = ? AND questId = ?', [userId, questId], (err, completed) => {
        if (completed) {
            return res.json({ message: 'Quest already completed!' });
        }
        db.get('SELECT * FROM quests WHERE id = ?', [questId], (err, quest) => {
            if (err || !quest) return res.status(500).json({ error: 'Quest not found' });
            const tokenField = quest.tokenType === 'TON' ? 'tonBalance' : 'fzyBalance';
            db.run(`UPDATE users SET ${tokenField} = ${tokenField} + ?, questsCompleted = questsCompleted + 1 WHERE userId = ?`,
                [quest.reward, userId]);
            db.run('INSERT INTO completed_quests (userId, questId) VALUES (?, ?)', [userId, questId]);
            res.json({ message: 'Reward claimed successfully!' });
        });
    });
});

app.post('/withdraw', (req, res) => {
    const { userId, type, token, amount, address, username } = req.body;
    db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        db.all('SELECT * FROM settings', [], (err, rows) => {
            const settings = {};
            rows.forEach(row => settings[row.key] = row.value);

            const balanceField = token === 'TON' ? 'tonBalance' : 'fzyBalance';
            const balance = user[balanceField];
            const minKey = `${type}${token}Min`;
            const feeKey = `${type}${token}Fee`;
            const min = parseFloat(settings[minKey]);
            const fee = parseFloat(settings[feeKey]);

            if (amount < min) {
                return res.json({ success: false, message: `Minimum withdraw amount is ${min} ${token}` });
            }

            if (balance < amount + fee) {
                return res.json({ success: false, message: 'Insufficient balance (including fee)' });
            }

            if (type === 'internal') {
                db.get('SELECT * FROM users WHERE username = ?', [username], (err, targetUser) => {
                    if (!targetUser) {
                        return res.json({ success: false, message: 'Target user not found' });
                    }
                    db.run(`UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE userId = ?`, [amount + fee, userId]);
                    db.run(`UPDATE users SET ${balanceField} = ${balanceField} + ? WHERE userId = ?`, [amount, targetUser.userId]);
                    res.json({ success: true, message: 'Transfer successful!' });
                });
            } else {
                db.run(`UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE userId = ?`, [amount + fee, userId]);
                res.json({ success: true, message: 'Withdraw request submitted!' });
            }
        });
    });
});

app.get('/settings', (req, res) => {
    db.all('SELECT * FROM settings', [], (err, rows) => {
        const settings = {};
        rows.forEach(row => settings[row.key] = row.value);
        res.json(settings);
    });
});

app.post('/admin/update-setting', (req, res) => {
    const { key, value } = req.body;
    db.run('UPDATE settings SET value = ? WHERE key = ?', [value, key], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Setting updated successfully!' });
    });
});

app.get('/leaderboard', (req, res) => {
    db.all('SELECT userId, username, invitations FROM users ORDER BY invitations DESC LIMIT 10', [], (err, users) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(users);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});