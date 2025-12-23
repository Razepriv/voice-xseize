// Usage: node test-agent-kb-link.js <agentId> <organizationId> <bearerToken>
// Prints the agent's knowledgeBaseIds after upload

const fetch = require('node-fetch');

async function getAgent(agentId, organizationId, bearerToken) {
  const url = `http://localhost:5000/api/ai-agents/${agentId}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
      'X-Organization-Id': organizationId,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch agent: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

(async () => {
  const [,, agentId, organizationId, bearerToken] = process.argv;
  if (!agentId || !organizationId || !bearerToken) {
    console.error('Usage: node test-agent-kb-link.js <agentId> <organizationId> <bearerToken>');
    process.exit(1);
  }
  try {
    const agent = await getAgent(agentId, organizationId, bearerToken);
    console.log('Agent knowledgeBaseIds:', agent.knowledgeBaseIds);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
