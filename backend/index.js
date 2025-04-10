const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
const app = express();

app.use(express.json());
app.use(express.static('../app')); // Serve main app
app.use('/admin', express.static('../admin')); // Serve admin panel

const token = '7944961147:AAHZNBCOUfqDBRb6MXSFK-Yz0j0rpKv_O0Y';
const bot = new TelegramBot(token, { polling: true });

const db = new sqlite3.Database('./db/database.sqlite', (err) => {
    if (err) console.error(err);
    console.log('Connected to SQLite');
});

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
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('externalFzyFee', '2')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('internalTonMin', '0.5')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('internalTonFee', '0.05')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('internalFzyMin', '5')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('internalFzyFee', '0.5')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('inviteRewardAmount', '1')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('inviteRewardToken', 'TON')`);
    const quests = [
        { name: 'Join Channel', actionLink: 'https://t.me/channel', reward: 5, tokenType: 'FZY', timer: 30, tonPayment: 0 },
        { name: 'Premium Quest', actionLink: 'https://example.com', reward: 20, tokenType: 'TON', timer: 30, tonPayment: 0.5 }
    ];
    quests.forEach(q => {
        db.run('INSERT OR IGNORE INTO quests (name, actionLink, reward, tokenType, timer, tonPayment) VALUES (?, ?, ?, ?, ?, ?)',
            [q.name, q.actionLink, q.reward, q.tokenType, q.timer, q.tonPayment]);
    });
});

app.get('/user/:userId', (req, res) => {
    const { userId } = req.params;
    const { username } = req.query;
    db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
        if (!user) {
            db.run('INSERT INTO users (userId, username, tonBalance) VALUES (?, ?, ?)', [userId, username, 10]);
            return res.json({ tonBalance: 10, fzyBalance: 0, invitations: 0, questsCompleted: 0 });
        }
        res.json(user);
    });
});

app.get('/quests', (req, res) => {
    db.all('SELECT * FROM quests', [], (err, quests) => res.json(quests));
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
            res.json({ message: err ? 'Error adding quest' : 'Quest added' });
        });
});

app.post('/remove-quest', (req, res) => {
    const { questId } = req.body;
    db.run('DELETE FROM quests WHERE id = ?', [questId], (err) => {
        res.json({ message: err ? 'Error removing quest' : 'Quest removed' });
    });
});

app.post('/claim-reward', (req, res) => {
    const { userId, questId } = req.body;
    db.get('SELECT * FROM completed_quests WHERE userId = ? AND questId = ?', [userId, questId], (err, completed) => {
        if (completed) return res.json({ message: 'Quest already completed' });
        db.get('SELECT * FROM quests WHERE id = ?', [questId], (err, quest) => {
            const tokenField = quest.tokenType === 'TON' ? 'tonBalance' : 'fzyBalance';
            db.run(`UPDATE users SET ${tokenField} = ${tokenField} + ?, questsCompleted = questsCompleted + 1 WHERE userId = ?`,
                [quest.reward, userId]);
            db.run('INSERT INTO completed_quests (userId, questId) VALUES (?, ?)', [userId, questId]);
            res.json({ message: 'Reward claimed' });
        });
    });
});

app.post('/withdraw', (req, res) => {
    const { userId, type, token, amount, address, username } = req.body;
    db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
        db.all('SELECT * FROM settings', [], (err, rows) => {
            const settings = {};
            rows.forEach(row => settings[row.key] = row.value);
            const balanceField = token === 'TON' ? 'tonBalance' : 'fzyBalance';
            const min = parseFloat(settings[`${type}${token}Min`]);
            const fee = parseFloat(settings[`${type}${token}Fee`]);
            if (amount < min) return res.json({ success: false, message: `Minimum ${min} ${token}` });
            if (user[balanceField] < amount + fee) return res.json({ success: false, message: 'Insufficient balance' });

            if (type === 'internal') {
                db.get('SELECT * FROM users WHERE username = ?', [username], (err, targetUser) => {
                    if (!targetUser) return res.json({ success: false, message: 'User not found' });
                    db.run(`UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE userId = ?`, [amount + fee, userId]);
                    db.run(`UPDATE users SET ${balanceField} = ${balanceField} + ? WHERE userId = ?`, [amount, targetUser.userId]);
                    res.json({ success: true, message: 'P2P transfer completed' });
                });
            } else {
                db.run(`UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE userId = ?`, [amount + fee, userId]);
                res.json({ success: true, message: 'Withdraw submitted' });
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
        res.json({ message: err ? 'Error updating' : 'Setting updated' });
    });
});

app.listen(3000, () => console.log('Server running on port 3000'));