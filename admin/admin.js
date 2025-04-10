const ADMIN_SECRET = 'MySecretKey2025';

function verifySecret() {
    const input = document.getElementById('secret-key').value;
    if (input === ADMIN_SECRET) {
        document.getElementById('secret-prompt').style.display = 'none';
        document.querySelector('.admin-container').style.display = 'block';
        loadAdminData();
    } else {
        alert('Invalid secret key!');
    }
}

function loadAdminData() {
    fetch('http://localhost:3000/users')
        .then(response => response.json())
        .then(users => {
            const tbody = document.getElementById('user-database');
            tbody.innerHTML = '';
            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.userId}</td>
                    <td>${user.username}</td>
                    <td>${user.tonBalance}</td>
                    <td>${user.fzyBalance}</td>
                    <td>${user.invitations}</td>
                    <td>${user.questsCompleted || 0}</td>
                `;
                tbody.appendChild(row);
            });
        });

    fetch('http://localhost:3000/quests')
        .then(response => response.json())
        .then(quests => {
            const adminQuestList = document.getElementById('admin-quest-list');
            adminQuestList.innerHTML = '';
            quests.forEach(quest => {
                const questItem = document.createElement('div');
                questItem.className = 'quest-item';
                questItem.innerHTML = `
                    <p>${quest.name} - ${quest.reward} ${quest.tokenType} (Timer: ${quest.timer}s, TON Payment: ${quest.tonPayment})</p>
                    <button onclick="removeQuest('${quest.id}')">Remove</button>
                `;
                adminQuestList.appendChild(questItem);
            });
        });

    fetch('http://localhost:3000/leaderboard')
        .then(response => response.json())
        .then(users => {
            const tbody = document.getElementById('leaderboard');
            tbody.innerHTML = '';
            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.userId}</td>
                    <td>${user.username}</td>
                    <td>${user.invitations}</td>
                `;
                tbody.appendChild(row);
            });
        });

    fetch('http://localhost:3000/settings')
        .then(response => response.json())
        .then(settings => {
            document.getElementById('externalTonMin').value = settings.externalTonMin;
            document.getElementById('externalTonFee').value = settings.externalTonFee;
            document.getElementById('externalFzyMin').value = settings.externalFzyMin;
            document.getElementById('externalFzyFee').value = settings.externalFzyFee;
            document.getElementById('internalTonMin').value = settings.internalTonMin;
            document.getElementById('internalTonFee').value = settings.internalTonFee;
            document.getElementById('internalFzyMin').value = settings.internalFzyMin;
            document.getElementById('internalFzyFee').value = settings.internalFzyFee;
            document.getElementById('inviteRewardAmount').value = settings.inviteRewardAmount;
            document.getElementById('inviteRewardToken').value = settings.inviteRewardToken;
        });
}

function addQuest() {
    const name = document.getElementById('quest-name').value;
    const actionLink = document.getElementById('quest-link').value;
    const reward = parseFloat(document.getElementById('quest-reward').value);
    const tokenType = document.getElementById('quest-token').value;
    const timer = parseInt(document.getElementById('quest-timer').value);
    const tonPayment = parseFloat(document.getElementById('quest-ton-payment').value);

    fetch('http://localhost:3000/add-quest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, actionLink, reward, tokenType, timer, tonPayment })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        loadAdminData();
    });
}

function removeQuest(questId) {
    fetch('http://localhost:3000/remove-quest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        loadAdminData();
    });
}

function updateSetting(key) {
    const value = document.getElementById(key).value;
    fetch('http://localhost:3000/admin/update-setting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        loadAdminData();
    });
}