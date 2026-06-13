import { llmWithTools, llm, SATHI_TOOLS } from './backend/lib/ai';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the backend directory
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

async function debugAI() {
  const prompt = "Explain Ohm's Law";
  const systemPrompt = "You are Sathi, a multilingual AI Physics Tutor. Use tools to create a tutorial.";

  console.log('--- Phase 1: Testing llmWithTools (Agentic) ---');
  try {
    const agentResult = await llmWithTools(prompt, systemPrompt, SATHI_TOOLS);
    console.log('Agent Result:', JSON.stringify(agentResult, null, 2));
  } catch (err) {
    console.error('Agent Phase Failed:', err);
  }

  console.log('\n--- Phase 2: Testing llm (Structured JSON Fallback) ---');
  try {
    const fallbackPrompt = `You must provide a JSON tutorial for: ${prompt}.
    Return a JSON object with: 
    { "steps": [ { "title": "...", "instruction": "...", "explanation": "..." } ] }`;
    const jsonResult = await llm(fallbackPrompt, 'You are an AI Physics Tutor. Reply ONLY in VALID JSON.', true);
    console.log('JSON Result Raw:', jsonResult);
    if (jsonResult) {
      const parsed = JSON.parse(jsonResult);
      console.log('JSON Parsed Successfully:', parsed);
    }
  } catch (err) {
    console.error('JSON Phase Failed:', err);
  }
}

debugAI().then(() => console.log('\nDebug session complete.'));
