document.addEventListener('DOMContentLoaded', () => {
  const userId = '12345'; // Replace with actual user ID from Telegram
  const username = 'Player1'; // Replace with actual username

  // Fetch user data
  fetch(`https://fuzzy-play-backend.onrender.com/user/${userId}?username=${encodeURIComponent(username)}`)
    .then(response => response.json())
    .then(data => {
      document.getElementById('user-balance').textContent = `Balance: ${data.balance}`;
    })
    .catch(error => console.error('Error fetching user data:', error));

  // Fetch quests
  fetch('https://fuzzy-play-backend.onrender.com/quests')
    .then(response => response.json())
    .then(quests => {
      const questList = document.getElementById('quest-list');
      quests.forEach(quest => {
        const li = document.createElement('li');
        li.textContent = `${quest.title}: ${quest.description} (Reward: ${quest.reward})`;
        questList.appendChild(li);
      });
    })
    .catch(error => console.error('Error fetching quests:', error));
});