import { SessionsClient } from '@google-cloud/dialogflow-cx';

const projectId = process.env.GOOGLE_PROJECT_ID;
const location = process.env.GOOGLE_LOCATION;
const agentId = process.env.GOOGLE_AGENT_ID;
const languageCode = 'en';

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);

const sessionClient = new SessionsClient({
  projectId,
  credentials
});

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }
  console.log("METHOD RECEIVED:", event.httpMethod);

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
        text: message
      },
      languageCode
    }
  };

  try {
    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult.responseMessages[0].text.text[0];
    return {
      statusCode: 200,
      body: JSON.stringify({ reply: result })
    };
  } catch (err) {
    console.error('Dialogflow error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ reply: 'Something went wrong talking to the AI service.' })
    };
  }
}
