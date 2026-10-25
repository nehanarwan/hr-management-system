
const SUGGESTIONS = {
  employee: [
    'How many leave days do I have left?',
    'Do I have any pending requests?',
    'When is my next approved leave?',
    'What is the company leave policy?',
  ],
  manager: [
    'How many pending requests do I have?',
    "Who's off in my team this month?",
    'How many leave days do I have left?',
    'What is the company leave policy?',
  ],
};

function createChat(container, role) {
  let sessionId = null;

  container.innerHTML = `
    <div class="chat-box">
      <div class="suggestions"></div>
      <div class="chat-log"></div>
      <form class="chat-form">
        <input type="text" placeholder="Ask about your leave..." autocomplete="off" required>
        <button type="submit" class="btn">Send</button>
      </form>
    </div>`;

  const log = container.querySelector('.chat-log');
  const form = container.querySelector('.chat-form');
  const input = container.querySelector('.chat-form input');
  const suggestions = container.querySelector('.suggestions');

  (SUGGESTIONS[role] || SUGGESTIONS.employee).forEach((text) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.onclick = () => { input.value = text; form.requestSubmit(); };
    suggestions.appendChild(button);
  });

  function addMessage(role_, text, extraClass) {
    const div = document.createElement('div');
    div.className = 'msg ' + role_ + (extraClass ? ' ' + extraClass : '');
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  addMessage('assistant', 'Hello. Ask me anything about your leave, your requests or the company policy.');

  form.onsubmit = async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    input.value = '';
    addMessage('user', question);
    const thinking = addMessage('assistant', 'Looking that up...', 'thinking');

    try {
      const result = await api.post('/api/chat', { message: question, sessionId });
      sessionId = result.data.sessionId;
      thinking.remove();
      addMessage('assistant', result.data.answer);
    } catch (err) {
      thinking.remove();
      addMessage('assistant', 'Sorry - ' + err.message);
    }
  };

  return { focus: () => input.focus() };
}


function mountChatWidget(role) {
  const fab = document.createElement('button');
  fab.className = 'chat-fab';
  fab.title = 'HR assistant';
  fab.textContent = '?';

  const panel = document.createElement('div');
  panel.className = 'chat-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <header><strong>HR assistant</strong><button type="button" aria-label="Close">&times;</button></header>
    <div class="chat-mount"></div>`;

  let chat = null;
  fab.onclick = () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden && !chat) {
      chat = createChat(panel.querySelector('.chat-mount'), role);
      chat.focus();
    }
  };
  panel.querySelector('header button').onclick = () => { panel.hidden = true; };

  document.body.appendChild(fab);
  document.body.appendChild(panel);
}
