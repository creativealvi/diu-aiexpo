// netlify/functions/message.js
import { SessionsClient } from '@google-cloud/dialogflow-cx';

const projectId = process.env.GOOGLE_PROJECT_ID;
const location = process.env.GOOGLE_LOCATION;
const agentId = process.env.GOOGLE_AGENT_ID;
const languageCode = 'en';

if (!projectId || !location || !agentId) {
  throw new Error('Missing required environment variables (GOOGLE_PROJECT_ID, GOOGLE_LOCATION, or GOOGLE_AGENT_ID)');
}

const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
if (!credentialsJson) {
  throw new Error('GOOGLE_CREDENTIALS_JSON is not defined in the environment variables');
}

const credentials = JSON.parse(credentialsJson);
const sessionClient = new SessionsClient({
  projectId: projectId,
  credentials: credentials,
});

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  const { message } = JSON.parse(event.body);
  const sessionId = Math.random().toString(36).substring(7);

  const sessionPath = sessionClient.projectLocationAgentSessionPath(
    projectId,
    location,
    agentId,
    sessionId
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: message,
      },
      languageCode,
    },
  };

  try {
    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult.responseMessages[0].text.text[0];
    return {
      statusCode: 200,
      body: JSON.stringify({ reply: result }),
    };
  } catch (err) {
    console.error('Dialogflow error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ reply: "Sorry, I'm having trouble connecting to the AI service." }),
    };
  }
}