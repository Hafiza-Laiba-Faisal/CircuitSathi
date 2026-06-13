import OpenAI from 'openai'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

// ─── OpenRouter Client ────────────────────────────────────────────────────────
const getClient = () => {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || apiKey.includes('your_')) {
    console.warn('⚠️ OPENROUTER_API_KEY is missing or invalid. AI features will be disabled.')
    return null
  }

  // Sanitise baseURL — OpenAI SDK appends /chat/completions itself
  let baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
  baseURL = baseURL.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '')

  return new OpenAI({
    baseURL, apiKey,
    timeout: 180000, // 180 seconds as per user example
    maxRetries: 0,
    defaultHeaders: { 
      'HTTP-Referer': 'http://localhost:3001', 
      'X-Title': 'CircuitSathi STEM Tutor' 
    },
  })
}

/**
 * Robust JSON extraction (Mirroring the user's Python logic)
 */
function extractJSON(text: string): any {
  if (!text) return null
  
  // 1. Try direct parse
  try { return JSON.parse(text) } catch (e) {}

  // 2. Clean markdown code blocks
  let cleaned = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim()
  try { return JSON.parse(cleaned) } catch (e) {}

  // 3. Find first { and last }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    try {
      const jsonStr = cleaned.substring(start, end + 1)
      return JSON.parse(jsonStr)
    } catch (e) {}
  }

  return null
}

// ─── Sathi Tool Definitions ──────────────────────────────────────────────────
export const SATHI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'generate_tutorial',
      description: 'Generate a complete STEM tutorial including all steps and the starting circuit.',
      parameters: {
        type: 'object',
        properties: {
          starting_circuit: {
            type: 'object',
            properties: {
              components: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id:    { type: 'string' },
                    type:  { type: 'string', enum: ['battery', 'resistor', 'led', 'capacitor', 'switch', 'ground', 'motor'] },
                    label: { type: 'string' },
                    value: { type: 'number' },
                    position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } }
                  },
                  required: ['id', 'type', 'label', 'position']
                }
              },
              edges: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    sourceId: { type: 'string' },
                    targetId: { type: 'string' }
                  },
                  required: ['id', 'sourceId', 'targetId']
                }
              }
            },
            required: ['components', 'edges']
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title:       { type: 'string' },
                instruction: { type: 'string' },
                explanation: { type: 'string' },
                requiredComponents: { type: 'array', items: { type: 'string' } }
              },
              required: ['title', 'instruction', 'explanation']
            }
          }
        },
        required: ['starting_circuit', 'steps']
      }
    }
  }
]

export interface ToolCallResult {
  steps: Array<{
    id: string
    title: string
    instruction: string
    explanation: string
    goalCriteria: { requiredComponents: string[]; powered: boolean }
    initialGraph?: { components: any[]; edges: any[] }
  }>
  finalMessage: string | null
  circuits: Array<{ components: any[]; edges: any[] }>
}

/**
 * Normal Chat Completion helper
 */
export async function llm(prompt: string, systemPrompt: string, isJSON: boolean = false): Promise<string | null> {
  const client = getClient()
  if (!client) return null

  try {
    const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    } as any)

    return response.choices[0].message.content
  } catch (err) {
    console.error('[AI] Chat generation failed:', err)
    return null
  }
}

/**
 * Advanced Tool-Calling Conversation Loop
 */
export async function llmWithTools(prompt: string, systemPrompt: string, tools: any[]): Promise<ToolCallResult | null> {
  const client = getClient()
  if (!client) return null
  const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ]

  const collectedSteps: ToolCallResult['steps'] = []
  const collectedCircuits: ToolCallResult['circuits'] = []
  let finalMessage: string | null = null

  const MAX_ROUNDS = 5
  for (let round = 0; round < MAX_ROUNDS; round++) {
    try {
      console.log(`\n\x1b[36m[Sathi Round ${round + 1}/${MAX_ROUNDS}] Thinking...\x1b[0m`)
      
      const response = await client.chat.completions.create({ 
        model, 
        messages, 
        tools,
        tool_choice: 'required'
      } as any)
      
      // 🕵️ DEBUG: Log raw response for provider diagnosis
      console.log(`\x1b[90m[DEBUG] Provider Response:\n${JSON.stringify(response, null, 2)}\x1b[0m`)

      if (!response || !response.choices || response.choices.length === 0) {
        console.warn(`\x1b[31m[Sathi] Round ${round + 1} failed: No choices in response.\x1b[0m`)
        break
      }

      const assistantMsg = response.choices[0].message
      if (!assistantMsg) {
        console.warn(`\x1b[31m[Sathi] Round ${round + 1} failed: Empty message object.\x1b[0m`)
        break
      }

      messages.push(assistantMsg as any)

      if (!assistantMsg.tool_calls?.length) {
        console.log(`\x1b[32m[Sathi] Found final response text.\x1b[0m`)
        finalMessage = assistantMsg.content || null
        break
      }

      console.log(`\x1b[33m[Sathi] Received ${assistantMsg.tool_calls.length} action(s):\x1b[0m`)

      for (const tc of assistantMsg.tool_calls) {
        const toolCall = tc as any
        const fnName = toolCall.function.name
        const args = extractJSON(toolCall.function.arguments)
        
        if (!args) {
          console.log(`  ❌ \x1b[31m${fnName}: Malformed JSON\x1b[0m`)
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: "Invalid JSON" }) } as any)
          continue
        }

        if (fnName === 'generate_tutorial') {
          console.log(`  🏛️  \x1b[32mgenerate_tutorial\x1b[0m: ${args.steps?.length || 0} steps, ${args.starting_circuit?.components?.length || 0} components`)
          
          if (args.starting_circuit) {
            collectedCircuits.push(args.starting_circuit)
          }

          if (args.steps && Array.isArray(args.steps)) {
            for (const s of args.steps) {
              collectedSteps.push({
                id: Math.random().toString(36).substr(2, 9),
                title: s.title || 'Step',
                instruction: s.instruction || '',
                explanation: s.explanation || '',
                goalCriteria: { requiredComponents: s.requiredComponents || [], powered: true }
              })
            }
          }
          
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ success: true, steps_collected: collectedSteps.length }) } as any)
        }
      }
    } catch (err: any) {
      console.warn(`\n\x1b[31m[Sathi] Error in Round ${round + 1}: ${err.message}\x1b[0m`)
      break
    }
  }

  if (collectedSteps.length === 0) {
    console.log(`\x1b[31m[Sathi] Failed to generate any tutorial steps.\x1b[0m`)
    return null
  }

  console.log(`\x1b[35m[Sathi] Tutorial Generation Complete: ${collectedSteps.length} steps, ${collectedCircuits.length} circuits.\x1b[0m\n`)
  if (collectedCircuits.length > 0) collectedSteps[0].initialGraph = collectedCircuits[0]

  return { steps: collectedSteps, finalMessage, circuits: collectedCircuits }
}

// ─── CAMB.AI (TTS) ───────────────────────────────────────────────────────────
export const tts = async (text: string, language: string = 'en-us') => {
  const apiKey = process.env.CAMBAI_API_KEY
  if (!apiKey || apiKey.includes('your_')) {
    console.warn('⚠️ CAMBAI_API_KEY is missing or invalid. TTS will be disabled.')
    return null
  }
  try {
    const response = await axios.post(
      'https://client.camb.ai/apis/tts-stream',
      {
        text: text,
        voice_id: 147320,
        language: language,
        speech_model: 'mars-8.1-flash-beta',
        output_configuration: { format: 'wav' }
      },
      {
        headers: { 
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    )
    return response.data
  } catch (err) {
    console.error('CAMB.AI Error:', err)
    return null
  }
}
