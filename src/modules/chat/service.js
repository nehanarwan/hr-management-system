const pool = require('../../config/db');
const env = require('../../config/env');
const { getToolsForUser } = require('./tools');
const fallback = require('./fallback');

const MAX_TOOL_ROUNDS = 4;

function systemPrompt(user) {
  return [
    'You are the HR assistant inside an HR management system.',
    `You are speaking to ${user.firstName || 'an employee'}, whose role is "${user.role}".`,
    '',
    'Rules you must follow:',
    '- Answer only from the tools. Never guess a number, a date or a status.',
    '- The tools already know who is asking. There is no way to look up another company,',
    '  and an employee can only ever see their own data. If someone asks for information',
    '  you have no tool for, say plainly that you cannot see it.',
    '- Be short and direct. Two or three sentences is usually enough.',
    '- Give dates as they appear in the data, and always say how many days a period is.',
  ].join('\n');
}
async function askClaude(user, question, history, tools) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: env.anthropicApiKey });

  const toolDefinitions = Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 1024,
      system: systemPrompt(user),
      tools: toolDefinitions,
      messages,
    });

    if (response.stop_reason !== 'tool_use') {
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      return text || 'Sorry, I could not work that out.';
    }

    messages.push({ role: 'assistant', content: response.content });

    const results = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      const tool = tools[block.name];
      let output;
      if (!tool) {
        output = { error: 'That tool does not exist.' };
      } else {
        try {
          output = await tool.run(user, block.input || {});
        } catch (err) {
          output = { error: err.message };
        }
      }

      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(output),
      });
    }

    messages.push({ role: 'user', content: results });
  }

  return 'Sorry, that took too many steps. Could you ask it a different way?';
}

async function ask(user, question, sessionId) {
  const tools = getToolsForUser(user);

  const session = await getOrCreateSession(user, sessionId);
  const history = await getMessages(user.companyId, session.id, 10);

  let answer;
  if (env.anthropicApiKey) {
    try {
      answer = await askClaude(user, question, history, tools);
    } catch (err) {
      console.error(`[chat] Claude API call failed: ${err.message}`);
      answer = await fallback.answer(user, question, tools);
    }
  } else {
    answer = await fallback.answer(user, question, tools);
  }

  await saveMessage(user.companyId, session.id, 'user', question);
  await saveMessage(user.companyId, session.id, 'assistant', answer);

  return { sessionId: session.id, answer };
}

async function getOrCreateSession(user, sessionId) {
  if (sessionId) {
    const found = await pool.query(
      'SELECT * FROM chat_sessions WHERE company_id = $1 AND user_id = $2 AND id = $3',
      [user.companyId, user.id, sessionId]
    );
    if (found.rows[0]) return found.rows[0];
  }

  const created = await pool.query(
    'INSERT INTO chat_sessions (company_id, user_id) VALUES ($1, $2) RETURNING *',
    [user.companyId, user.id]
  );
  return created.rows[0];
}

async function saveMessage(companyId, sessionId, role, content) {
  await pool.query(
    'INSERT INTO chat_messages (session_id, company_id, role, content) VALUES ($1, $2, $3, $4)',
    [sessionId, companyId, role, content]
  );
}

async function getMessages(companyId, sessionId, limit) {
  const result = await pool.query(
    `SELECT role, content, created_at FROM chat_messages
     WHERE company_id = $1 AND session_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [companyId, sessionId, limit]
  );
  return result.rows.reverse();
}

async function getHistory(user, sessionId) {
  if (sessionId) {
    const session = await pool.query(
      'SELECT id FROM chat_sessions WHERE company_id = $1 AND user_id = $2 AND id = $3',
      [user.companyId, user.id, sessionId]
    );
    if (!session.rows[0]) return null;
    return getMessages(user.companyId, sessionId, 100);
  }

  const latest = await pool.query(
    'SELECT id FROM chat_sessions WHERE company_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
    [user.companyId, user.id]
  );
  if (!latest.rows[0]) return [];
  return getMessages(user.companyId, latest.rows[0].id, 100);
}

module.exports = { ask, getHistory };
