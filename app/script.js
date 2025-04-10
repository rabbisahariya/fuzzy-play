// Telegram Web App Integration
const tg = window.Telegram.WebApp;
tg.ready();

// TON Connect UI
const tonConnectUI = new TONConnectUI({
    manifestUrl: 'http://localhost:3000/tonconnect-manifest.json',
    buttonRootId: null
});

// Get the user ID and username from Telegram
let userId, username;
const user = tg.initDataUnsafe.user;
if (user) {
    userId = user.id;
    username = user.username || user.first_name;
} else {
    userId = 'test_user';
    username = 'TestUser';
}

// Admin TON address for payments
const ADMIN_TON_ADDRESS = 'UQBOpnTCDGMtIxpIY21x6hSpzqNfZPuA_i54sTHVRT6yD0El';

// Simulated balance history
let balanceHistory = [
    { type: 'Reward', token: 'FZY', amount: 5, date: '2025-04-08' },
    { type: 'Withdraw', token: 'TON', amount: 2, date: '2025-04-07' }
];

// All quests (for filtering)
let allQuests = [];

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('welcomeShown')) {
        document.getElementById('welcome-popup').style.display = 'flex';
        localStorage.setItem('welcomeShown', 'true');
    }

    loadUserData();
    loadQuests();
});

// Load user data
function loadUserData() {
    fetch(`http://localhost:3000/user/${userId}?username=${encodeURIComponent(username)}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('ton-balance').innerText = data.tonBalance;
            document.getElementById('fzy-balance').innerText = data.fzyBalance;
            document.getElementById('invitations').innerText = data.invitations;
            document.getElementById('invitation-badge').innerText = data.invitations;
            document.getElementById('invite-link').value = `https://t.me/FuzzyPlayBot?start=${userId}`;
            document.getElementById('username').innerText = username;
            document.getElementById('quests-completed').innerText = data.questsCompleted || 0;

            const historyContainer = document.getElementById('balance-history');
            historyContainer.innerHTML = '';
            balanceHistory.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <p>${entry.type}: ${entry.amount} ${entry.token}</p>
                    <p>Date: ${entry.date}</p>
                `;
                historyContainer.appendChild(item);
            });
        });

    fetch('http://localhost:3000/settings')
        .then(response => response.json())
        .then(settings => {
            document.getElementById('invite-reward-amount').innerText = settings.inviteRewardAmount;
            document.getElementById('invite-reward-token').innerText = settings.inviteRewardToken;
            document.getElementById('withdraw-info').innerText = `Minimum: ${settings.externalTonMin} TON | Fee: ${settings.externalTonFee} TON`;
        });

    fetch('http://localhost:3000/leaderboard')
        .then(response => response.json())
        .then(users => {
            const tbody = document.getElementById('user-leaderboard');
            tbody.innerHTML = '';
            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.invitations}</td>
                `;
                tbody.appendChild(row);
            });
        });
}

// Load quests
function loadQuests() {
    fetch('http://localhost:3000/quests')
        .then(response => response.json())
        .then(quests => {
            allQuests = quests;
            const featuredQuest = quests.find(q => q.name === 'Premium Quest');
            if (featuredQuest) {
                const featuredContainer = document.getElementById('featured-quest');
                featuredContainer.innerHTML = `
                    <h3>Featured: ${featuredQuest.name}</h3>
                    <p>Earn ${featuredQuest.reward} ${featuredQuest.tokenType} - ${featuredQuest.tonPayment > 0 ? `Pay ${featuredQuest.tonPayment} TON` : 'Free'}</p>
                `;
            }

            filterQuests('all');
        });
}

// Filter quests
function filterQuests(tokenType) {
    const questList = document.getElementById('quest-list');
    questList.innerHTML = '';

    const filteredQuests = tokenType === 'all' ? allQuests : allQuests.filter(q => q.tokenType === tokenType);

    filteredQuests.forEach(quest => {
        const questItem = document.createElement('div');
        questItem.className = 'quest-item';
        questItem.innerHTML = `
            <p><img src="assets/quest.png" alt="Quest Icon"> ${quest.name} - ${quest.reward} ${quest.tokenType}</p>
            <button class="claim-btn" onclick="startQuest('${quest.id}', '${quest.actionLink}', ${quest.timer}, ${quest.tonPayment})">
                ${quest.tonPayment > 0 ? `Pay ${quest.tonPayment} TON` : 'Start Quest'}
            </button>
            <div class="progress-bar" id="progress-${quest.id}">
                <div class="progress"></div>
            </div>
        `;
        questList.appendChild(questItem);
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.onclick.toString().includes(`'${tokenType}'`)) {
            btn.classList.add('active');
        }
    });
}

// Start a quest
async function startQuest(questId, actionLink, timer, tonPayment) {
    const response = await fetch(`http://localhost:3000/check-quest/${userId}/${questId}`);
    const data = await response.json();

    if (data.completed) {
        showNotification('Quest already completed!');
        return;
    }

    if (tonPayment > 0) {
        try {
            if (!tonConnectUI.connected) {
                await tonConnectUI.connectWallet();
                showNotification('Wallet connected!');
            }

            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 60,
                messages: [
                    {
                        address: ADMIN_TON_ADDRESS,
                        amount: (tonPayment * 1e9).toString(),
                    }
                ]
            };

            const result = await tonConnectUI.sendTransaction(transaction);
            showNotification('Payment sent! Verifying...');

            setTimeout(() => {
                showClaimButton(questId, timer);
                balanceHistory.push({ type: 'Payment', token: 'TON', amount: tonPayment, date: new Date().toISOString().split('T')[0] });
                fetch('http://localhost:3000/complete-ton-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, questId, amount: tonPayment })
                });
            }, 5000);
        } catch (error) {
            showNotification('Payment failed: ' + error.message);
        }
    } else {
        window.open(actionLink, '_blank');
        showClaimButton(questId, timer);
    }
}

// Show claim button with progress bar
function showClaimButton(questId, timer) {
    const questItem = document.querySelector(`button[onclick*="startQuest('${questId}'"]`).parentElement;
    const claimButton = document.createElement('button');
    claimButton.className = 'claim-btn';
    claimButton.innerText = `Claim in ${timer}s`;
    claimButton.disabled = true;
    questItem.querySelector('button').replaceWith(claimButton);

    const progressBar = document.getElementById(`progress-${questId}`).querySelector('.progress');
    let timeLeft = timer;
    const interval = setInterval(() => {
        timeLeft--;
        claimButton.innerText = `Claim in ${timeLeft}s`;
        progressBar.style.width = `${(timer - timeLeft) / timer * 100}%`;
        if (timeLeft <= 0) {
            clearInterval(interval);
            claimButton.innerText = 'Claim Reward';
            claimButton.disabled = false;
            claimButton.onclick = () => claimReward(questId);
        }
    }, 1000);
}

// Claim a quest reward
function claimReward(questId) {
    fetch('http://localhost:3000/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, questId })
    })
    .then(response => response.json())
    .then(data => {
        showNotification(data.message);
        loadUserData();
        loadQuests();
        fetch(`http://localhost:3000/quest/${questId}`)
            .then(response => response.json())
            .then(quest => {
                balanceHistory.push({
                    type: 'Reward',
                    token: quest.tokenType,
                    amount: quest.reward,
                    date: new Date().toISOString().split('T')[0]
                });
            });
    });
}

// Show a specific page
function showPage(page) {
    document.querySelectorAll('.page').forEach(container => {
        container.style.display = 'none';
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    document.querySelector(`#${page}-page`).style.display = 'block';
    document.querySelector(`.nav-item[onclick="showPage('${page}')"]`).classList.add('active');

    if (page === 'user-center') {
        loadUserData();
    }
}

// Withdraw Modal Functions
function showWithdrawModal() {
    document.getElementById('withdraw-modal').style.display = 'flex';
}

function hideWithdrawModal() {
    document.getElementById('withdraw-modal').style.display = 'none';
}

function updateWithdrawOptions() {
    const type = document.getElementById('withdraw-type').value;
    const token = document.getElementById('withdraw-token').value;
    const externalGroup = document.getElementById('external-address-group');
    const internalGroup = document.getElementById('internal-username-group');

    if (type === 'external') {
        externalGroup.style.display = 'block';
        internalGroup.style.display = 'none';
    } else {
        externalGroup.style.display = 'none';
        internalGroup.style.display = 'block';
    }

    fetch('http://localhost:3000/settings')
        .then(response => response.json())
        .then(settings => {
            const minKey = `${type}${token}Min`;
            const feeKey = `${type}${token}Fee`;
            document.getElementById('withdraw-info').innerText = `Minimum: ${settings[minKey]} ${token} | Fee: ${settings[feeKey]} ${token}`;
        });
}

function submitWithdraw() {
    const type = document.getElementById('withdraw-type').value;
    const token = document.getElementById('withdraw-token').value;
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const address = document.getElementById('external-address').value;
    const username = document.getElementById('internal-username').value;

    fetch('http://localhost:3000/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type, token, amount, address, username })
    })
    .then(response => response.json())
    .then(data => {
        showNotification(data.message);
        if (data.success) {
            loadUserData();
            hideWithdrawModal();
            balanceHistory.push({
                type: 'Withdraw',
                token: token,
                amount: amount,
                date: new Date().toISOString().split('T')[0]
            });
        }
    });
}

// Copy invite link
function copyInviteLink() {
    const link = document.getElementById('invite-link');
    link.select();
    document.execCommand('copy');
    showNotification('Invite link copied!');
}

// Popup and Notification Functions
function closePopup() {
    document.getElementById('welcome-popup').style.display = 'none';
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    document.getElementById('notification-message').innerText = message;
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}