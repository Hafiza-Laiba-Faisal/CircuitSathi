import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function testAxiosRaw() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  console.log('Testing Axios Raw to:', url);
  console.log('Model:', model);

  try {
    const response = await axios.post(
      url,
      {
        model,
        messages: [{ role: 'user', content: 'Say hello' }],
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://circuitsathi.edu',
          'X-Title': 'CircuitSathi',
        },
        timeout: 20000,
      }
    );

    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    if (err.response) {
      console.error('API Error:', err.response.status, err.response.data);
    } else {
      console.error('Request Error:', err.message);
    }
  }
}

testAxiosRaw();
