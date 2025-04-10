document.addEventListener('DOMContentLoaded', () => {
  fetch('https://fuzzy-play-backend.onrender.com/quests')
    .then(response => response.json())
    .then(quests => {
      const adminQuestList = document.getElementById('admin-quest-list');
      quests.forEach(quest => {
        const li = document.createElement('li');
        li.textContent = `Quest ${quest.id}: ${quest.title} - ${quest.description} (Reward: ${quest.reward})`;
        adminQuestList.appendChild(li);
      });
    })
    .catch(error => console.error('Error fetching quests:', error));
});