const tg = window.Telegram.WebApp;
tg.ready();

const tonConnectUI = new TONConnectUI({
    manifestUrl: 'https://fuzzy-play-backend.onrender.com/tonconnect-manifest.json'
});

const user = tg.initDataUnsafe.user || { id: 'test_user', username: 'TestUser' };
const userId = user.id;
const username = user.username || user.first_name;
const ADMIN_TON_ADDRESS = 'UQBOpnTCDGMtIxpIY21x6hSpzqNfZPuA_i54sTHVRT6yD0El';

let allQuests = [];

document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    loadQuests();
});

function loadUserData() {
    fetch(`https://fuzzy-play-backend.onrender.com/user/${userId}?username=${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('username').innerText = username;
            document.getElementById('ton-balance').innerText = data.tonBalance;
            document.getElementById('fzy-balance').innerText = data.fzyBalance;
            document.getElementById('invitations').innerText = data.invitations;
            document.getElementById('quests-completed').innerText = data.questsCompleted || 0;
            document.getElementById('invite-link').value = `https://t.me/FuzzyPlayBot?start=${userId}`;
            fetch('https://fuzzy-play-backend.onrender.com/settings')
                .then(res => res.json())
                .then(settings => {
                    document.getElementById('invite-reward-amount').innerText = settings.inviteRewardAmount;
                    document.getElementById('invite-reward-token').innerText = settings.inviteRewardToken;
                    updateWithdrawOptions();
                });
        });
}

function loadQuests() {
    fetch('https://fuzzy-play-backend.onrender.com/quests')
        .then(res => res.json())
        .then(quests => {
            allQuests = quests;
            const featured = quests.find(q => q.name === 'Premium Quest');
            if (featured) {
                document.getElementById('featured-quest').innerHTML = `
                    <h3>${featured.name}</h3>
                    <p>Earn ${featured.reward} ${featured.tokenType} - ${featured.tonPayment > 0 ? `Pay ${featured.tonPayment} TON` : 'Free'}</p>
                `;
            }
            filterQuests('all');
        });
}

function filterQuests(tokenType) {
    const questList = document.getElementById('quest-list');
    questList.innerHTML = '';
    const filtered = tokenType === 'all' ? allQuests : allQuests.filter(q => q.tokenType === tokenType);
    filtered.forEach(quest => {
        const item = document.createElement('div');
        item.className = 'quest-item';
        item.innerHTML = `
            <p><img src="assets/quest.png"> ${quest.name} - ${quest.reward} ${quest.tokenType}</p>
            <button class="action-btn" onclick="startQuest('${quest.id}', '${quest.actionLink}', ${quest.timer}, ${quest.tonPayment})">
                ${quest.tonPayment > 0 ? `Pay ${quest.tonPayment} TON` : 'Start'}
            </button>
        `;
        questList.appendChild(item);
    });
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.onclick.toString().includes(`'${tokenType}'`));
    });
}

async function startQuest(questId, actionLink, timer, tonPayment) {
    const res = await fetch(`https://fuzzy-play-backend.onrender.com/check-quest/${userId}/${questId}`);
    const data = await res.json();
    if (data.completed) return alert('Quest already completed!');
    
    if (tonPayment > 0) {
        if (!tonConnectUI.connected) await tonConnectUI.connectWallet();
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 60,
            messages: [{ address: ADMIN_TON_ADDRESS, amount: (tonPayment * 1e9).toString() }]
        };
        await tonConnectUI.sendTransaction(transaction);
        setTimeout(() => showClaimButton(questId, timer), 5000);
    } else {
        window.open(actionLink, '_blank');
        showClaimButton(questId, timer);
    }
}

function showClaimButton(questId, timer) {
    const btn = document.querySelector(`button[onclick*="startQuest('${questId}'"]`);
    btn.innerText = `Claim in ${timer}s`;
    btn.disabled = true;
    let timeLeft = timer;
    const interval = setInterval(() => {
        timeLeft--;
        btn.innerText = `Claim in ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(interval);
            btn.innerText = 'Claim Reward';
            btn.disabled = false;
            btn.onclick = () => claimReward(questId);
        }
    }, 1000);
}

function claimReward(questId) {
    fetch('https://fuzzy-play-backend.onrender.com/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, questId })
    })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            loadUserData();
            loadQuests();
        });
}

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`${page}-page`).style.display = 'block';
    document.querySelector(`.nav-item[onclick="showPage('${page}')"]`).classList.add('active');
    if (page === 'user-center') loadUserData();
}

function showWithdrawModal() {
    document.getElementById('withdraw-modal').style.display = 'flex';
    updateWithdrawOptions();
}

function hideWithdrawModal() {
    document.getElementById('withdraw-modal').style.display = 'none';
}

function updateWithdrawOptions() {
    const type = document.getElementById('withdraw-type').value;
    const token = document.getElementById('withdraw-token').value;
    const addressInput = document.getElementById('withdraw-address');
    const usernameInput = document.getElementById('withdraw-username');
    
    addressInput.style.display = type === 'external' ? 'block' : 'none';
    usernameInput.style.display = type === 'internal' ? 'block' : 'none';
    
    fetch('https://fuzzy-play-backend.onrender.com/settings')
        .then(res => res.json())
        .then(settings => {
            const min = settings[`${type}${token}Min`];
            const fee = settings[`${type}${token}Fee`];
            document.getElementById('withdraw-info').innerText = `Minimum: ${min} ${token} | Fee: ${fee} ${token}`;
        });
}

function submitWithdraw() {
    const type = document.getElementById('withdraw-type').value;
    const token = document.getElementById('withdraw-token').value;
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const address = document.getElementById('withdraw-address').value;
    const targetUsername = document.getElementById('withdraw-username').value;
    
    fetch('https://fuzzy-play-backend.onrender.com/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type, token, amount, address, username: targetUsername })
    })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            if (data.success) {
                loadUserData();
                hideWithdrawModal();
            }
        });
}

function copyInviteLink() {
    const link = document.getElementById('invite-link');
    link.select();
    document.execCommand('copy');
    alert('Invite link copied!');
}