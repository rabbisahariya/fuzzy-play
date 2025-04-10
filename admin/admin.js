document.addEventListener('DOMContentLoaded', loadAdminData);

function loadAdminData() {
    fetch('https://fuzzy-play-backend.onrender.com/quests')
        .then(res => res.json())
        .then(quests => {
            const list = document.getElementById('quest-list');
            list.innerHTML = '';
            quests.forEach(q => {
                const div = document.createElement('div');
                div.innerHTML = `${q.name} - ${q.reward} ${q.tokenType} (TON: ${q.tonPayment}) <button onclick="removeQuest('${q.id}')">Remove</button>`;
                list.appendChild(div);
            });
        });
    fetch('https://fuzzy-play-backend.onrender.com/settings')
        .then(res => res.json())
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
    const tonPayment = parseFloat(document.getElementById('quest-ton-payment').value || 0);
    fetch('https://fuzzy-play-backend.onrender.com/add-quest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, actionLink, reward, tokenType, timer, tonPayment })
    })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            loadAdminData();
        });
}

function removeQuest(questId) {
    fetch('https://fuzzy-play-backend.onrender.com/remove-quest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId })
    })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            loadAdminData();
        });
}

function updateSetting(key) {
    const value = document.getElementById(key).value;
    fetch('https://fuzzy-play-backend.onrender.com/admin/update-setting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
    })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            loadAdminData();
        });
}