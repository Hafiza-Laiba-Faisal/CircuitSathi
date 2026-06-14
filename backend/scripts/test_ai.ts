import { llmWithTools, llm, SATHI_TOOLS } from './lib/ai';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

async function debugAI() {
  const prompt = "Explain Ohm's Law";
  const systemPrompt = "You are Sathi, a multilingual AI Physics Tutor. Use tools to create a tutorial.";

  console.log('--- Phase 0: Checking environment ---');
  console.log('OPENROUTER_API_KEY present:', !!process.env.OPENROUTER_API_KEY);
  console.log('OPENROUTER_MODEL:', process.env.OPENROUTER_MODEL);
  console.log('OPENROUTER_BASE_URL:', process.env.OPENROUTER_BASE_URL);

  console.log('\n--- Phase 1: Testing llmWithTools (Agentic) ---');
  const start = Date.now();
  try {
    const agentResult = await llmWithTools(prompt, systemPrompt, SATHI_TOOLS);
    console.log('Agent Result:', JSON.stringify(agentResult, null, 2));
  } catch (err: any) {
    console.error('Agent Phase Failed Exception:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    console.log(`Phase 1 took ${Date.now() - start}ms`);
  }

  console.log('\n--- Phase 2: Testing llm ---');
  try {
    const jsonResult = await llm("Tell me a joke", "You are a helpful assistant.", false);
    console.log('Normal LLM Result Raw:', jsonResult);
  } catch (err: any) {
    console.error('Normal LLM Phase Failed:', err.message);
  }
}

debugAI().then(() => console.log('\nDebug session complete.'));
