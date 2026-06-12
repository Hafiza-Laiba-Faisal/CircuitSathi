import { Router, Request, Response } from 'express'
import multer from 'multer'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { CircuitGraph, CircuitNode, CircuitEdge, ComponentType } from '../../shared/types/circuit'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'])
const MIME_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
}

// POST /api/upload
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }

  const { originalname, buffer, mimetype } = req.file
  const ext = originalname.split('.').pop()?.toLowerCase() ?? ''

  try {
    let circuitGraph: CircuitGraph
    let format: string
    let confidence: number

    if (IMAGE_EXTS.has(ext) || mimetype.startsWith('image/')) {
      circuitGraph = await parseImageWithGemini(buffer, MIME_MAP[ext] || mimetype)
      format = 'image'
      confidence = 0.75
    } else {
      const text = buffer.toString('utf-8')
      if (ext === 'kicad_sch' || text.includes('(kicad_sch')) {
        circuitGraph = parseKicadSchematic(text)
        format = 'kicad_sch'
        confidence = 0.95
      } else if (ext === 'cddx' || ext === 'xml' || text.trimStart().startsWith('<?xml') || text.includes('<circuit')) {
        circuitGraph = parseCddxXml(text)
        format = 'cddx'
        confidence = 0.90
      } else if (['asc', 'cir', 'sp', 'spice', 'net', 'spi'].includes(ext)) {
        circuitGraph = parseSpiceText(text)
        format = 'spice'
        confidence = 0.90
      } else if (/^[*.]|^[RVCDLMQSI]\d/im.test(text.slice(0, 200))) {
        circuitGraph = parseSpiceText(text)
        format = 'spice'
        confidence = 0.80
      } else {
        res.status(400).json({ error: `Unsupported file format: .${ext}` })
        return
      }
    }

    res.json({ circuitGraph, format, confidence })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Upload parse error:', msg)
    res.status(422).json({ error: msg })
  }
})

export default router

/* ================================================================== */
/*  Gemini Vision — parse a schematic image into CircuitGraph          */
/* ================================================================== */

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']

async function parseImageWithGemini(imageBuffer: Buffer, mimeType: string): Promise<CircuitGraph> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set — cannot parse images.')
  const genAI = new GoogleGenerativeAI(apiKey)
  let lastError: Error | null = null
  for (const modelName of MODELS) {
    try {
      return await callGeminiVision(genAI, modelName, imageBuffer, mimeType)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const msg = lastError.message
      const isRetryable = msg.includes('429') || msg.includes('quota') || msg.includes('rate')
        || msg.includes('not found') || msg.includes('404') || msg.includes('invalid') || msg.includes('not supported')
      if (isRetryable) {
        console.warn(`Model ${modelName} unavailable (${msg.slice(0, 80)}), trying next...`)
        continue
      }
      throw lastError
    }
  }
  if (lastError?.message.includes('429') || lastError?.message.includes('quota')) {
    throw new Error('Gemini API rate limit reached. Check your API key quota.')
  }
  throw lastError ?? new Error('All Gemini models failed')
}

async function callGeminiVision(
  genAI: GoogleGenerativeAI,
  modelName: string,
  imageBuffer: Buffer,
  mimeType: string,
): Promise<CircuitGraph> {
  const model = genAI.getGenerativeModel({ model: modelName })
  const imagePart = { inlineData: { data: imageBuffer.toString('base64'), mimeType } }

  const prompt = `You are a circuit schematic parser. Analyze this circuit diagram and extract every electronic component and connection.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "nodes": [
    { "id": "n0", "type": "<type>", "value": <number_or_null>, "position": { "x": <number>, "y": <number> } }
  ],
  "edges": [
    { "id": "e0", "from": "<node_id>", "to": "<node_id>" }
  ]
}

Rules:
- "type" MUST be one of: resistor, capacitor, inductor, led, diode, voltageSource, currentSource, switch, ground, wire
- For batteries/voltage sources: type="voltageSource", value=voltage in volts (e.g. 6.0)
- For resistors: type="resistor", value=resistance in ohms (e.g. 2.0, 1.0, 3.0)
- For capacitors: type="capacitor", value=capacitance in Farads
- For inductors/coils: type="inductor", value=inductance in Henries
- For LEDs: type="led"
- For diodes: type="diode"
- For current sources: type="currentSource", value=current in Amps
- For switches: type="switch", isOn=true (closed) or isOn=false (open)
- For ground symbols: type="ground"
- For wire junctions: type="wire"
- Extract ALL components and connections visible. Use numeric values exactly as shown (e.g. 6.0 V, 2.0 Ω, 1.0 Ω).
- LAYOUT: Use a clean textbook schematic layout like "Figure 1": place voltage source on the left (e.g. x=0), then components in logical order (series then parallel branches). Use orthogonal positions so wires would form 90° angles (e.g. same x for vertical runs, same y for horizontal). Space components 150–200px apart. Preserve series/parallel structure from the diagram.
- edges: list which node ids are connected (from/to).`

  const result = await model.generateContent([prompt, imagePart])
  const text = result.response.text()
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

  let parsed: { nodes: { id: string; type: string; value?: number | null; isOn?: boolean; position?: { x: number; y: number } }[]; edges: { id: string; from: string; to: string }[] }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Gemini returned unparseable response: ${text.slice(0, 300)}`)
  }

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error('Gemini response missing "nodes" array.')
  }

  const VALID_TYPES = new Set<ComponentType>(['resistor', 'capacitor', 'inductor', 'led', 'diode', 'voltageSource', 'currentSource', 'switch', 'ground', 'wire'])
  const nodes: CircuitNode[] = parsed.nodes.map((c, i) => {
    const type: ComponentType = VALID_TYPES.has(c.type as ComponentType) ? (c.type as ComponentType) : 'resistor'
    return {
      id: c.id || `n${i}`,
      type,
      value: c.value ?? undefined,
      isOn: c.isOn,
      position: c.position ?? { x: 50 + i * 200, y: 150 },
    }
  })

  const nodeIds = new Set(nodes.map(n => n.id))
  const edgeSet = new Set<string>()
  const edges: CircuitEdge[] = []
  if (parsed.edges && Array.isArray(parsed.edges)) {
    for (const e of parsed.edges) {
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to) || e.from === e.to) continue
      const key = [e.from, e.to].sort().join('\x00')
      if (edgeSet.has(key)) continue
      edgeSet.add(key)
      edges.push({ id: e.id || `e${edges.length}`, from: e.from, to: e.to })
    }
  }

  // Only auto-layout if Gemini didn't supply meaningful positions (all at origin)
  const allAtOrigin = nodes.every(n => n.position?.x === 0 && n.position?.y === 0)
  if (allAtOrigin) layoutGraph(nodes, edges)
  return { nodes, edges }
}

/* ================================================================== */
/*  KiCad schematic parser (.kicad_sch S-expression format)           */
/* ================================================================== */

function parseKicadSchematic(text: string): CircuitGraph {
  const nodes: CircuitNode[] = []
  const edges: CircuitEdge[] = []
  const netToNodeIds = new Map<string, string[]>()

  // Extract symbols (components)
  // KiCad format: (symbol (lib_id "Device:R") (at X Y angle) (property "Reference" "R1") (property "Value" "10k") ...)
  const symbolRe = /\(symbol\s+\(lib_id\s+"([^"]+)"\)\s+([\s\S]*?)(?=\n\s*\(symbol|\n\s*\(wire|\n\s*\(net|\n\s*\(junction|\z)/g
  let sm: RegExpExecArray | null
  let nodeCounter = 0

  while ((sm = symbolRe.exec(text)) !== null) {
    const libId = sm[1]
    const body = sm[2]

    // Extract position
    const atMatch = body.match(/\(at\s+([\d.-]+)\s+([\d.-]+)/)
    const x = atMatch ? parseFloat(atMatch[1]) : nodeCounter * 100
    const y = atMatch ? parseFloat(atMatch[2]) : 0

    // Extract reference designator
    const refMatch = body.match(/\(property\s+"Reference"\s+"([^"]+)"/)
    const ref = refMatch ? refMatch[1] : `U${nodeCounter}`

    // Extract value
    const valMatch = body.match(/\(property\s+"Value"\s+"([^"]+)"/)
    const rawValue = valMatch ? valMatch[1] : ''

    const type = kicadLibIdToType(libId, ref)
    const value = parseSpiceValue(rawValue)
    const id = `kicad_${ref.replace(/[^a-zA-Z0-9_]/g, '_')}_${nodeCounter}`

    nodes.push({ id, type, value: isNaN(value) ? undefined : value, position: { x, y } })
    nodeCounter++
  }

  // Parse wires: (wire (pts (xy X1 Y1) (xy X2 Y2)))
  interface WireEndpoint { x: number; y: number }
  const wireEndpoints: { a: WireEndpoint; b: WireEndpoint }[] = []
  const wireRe = /\(wire\s+\(pts\s+\(xy\s+([\d.-]+)\s+([\d.-]+)\)\s+\(xy\s+([\d.-]+)\s+([\d.-]+)\)\)/g
  let wm: RegExpExecArray | null
  while ((wm = wireRe.exec(text)) !== null) {
    wireEndpoints.push({
      a: { x: parseFloat(wm[1]), y: parseFloat(wm[2]) },
      b: { x: parseFloat(wm[3]), y: parseFloat(wm[4]) },
    })
  }

  // Parse net labels
  const netRe = /\(net_label\s+.*?\(at\s+([\d.-]+)\s+([\d.-]+).*?\(property\s+"Value"\s+"([^"]+)"/g
  const labelRe2 = /\(label\s+"([^"]+)"\s+\(at\s+([\d.-]+)\s+([\d.-]+)/g
  const namedNets = new Map<string, { x: number; y: number }>()

  let nm: RegExpExecArray | null
  while ((nm = netRe.exec(text)) !== null) namedNets.set(nm[3], { x: parseFloat(nm[1]), y: parseFloat(nm[2]) })
  while ((nm = labelRe2.exec(text)) !== null) namedNets.set(nm[1], { x: parseFloat(nm[2]), y: parseFloat(nm[3]) })

  // Add ground node if referenced in netlist
  const hasGndRef = /\(pin_ref\s+"GND"\)|"GND"\s*\)/i.test(text) || text.includes('power:GND') || text.includes('"GND"')
  if (hasGndRef) {
    nodes.push({ id: 'kicad_GND', type: 'ground', position: { x: 0, y: 200 } })
    netToNodeIds.set('GND', ['kicad_GND'])
  }

  // For simple connectivity: connect components sharing the same net
  // Parse (pin (number "1") (name "~") (type ...) at X Y) style
  // Build net→component associations from pin positions matching wire endpoints
  // Simplified: create edges by proximity matching component positions to wire endpoints
  const SNAP = 25 // coordinate snap tolerance in mils

  function near(a: WireEndpoint, b: WireEndpoint): boolean {
    return Math.abs(a.x - b.x) < SNAP && Math.abs(a.y - b.y) < SNAP
  }

  // Assign wire junction groups (union-find on wire endpoints)
  const allPoints: WireEndpoint[] = wireEndpoints.flatMap(w => [w.a, w.b])
  const ptParent: number[] = allPoints.map((_, i) => i)

  function ptFind(i: number): number {
    while (ptParent[i] !== i) { ptParent[i] = ptParent[ptParent[i]]; i = ptParent[i] }
    return i
  }
  function ptUnion(i: number, j: number) { ptParent[ptFind(i)] = ptFind(j) }

  // Union wire endpoints that are at the same position
  for (let i = 0; i < allPoints.length; i++) {
    for (let j = i + 1; j < allPoints.length; j++) {
      if (near(allPoints[i], allPoints[j])) ptUnion(i, j)
    }
  }

  // Union the two endpoints of each wire
  for (let w = 0; w < wireEndpoints.length; w++) {
    ptUnion(w * 2, w * 2 + 1)
  }

  // Map net groups to component ids by position proximity
  const netGroupToComps = new Map<number, string[]>()
  for (const nd of nodes) {
    if (!nd.position) continue
    for (let i = 0; i < allPoints.length; i++) {
      if (near(nd.position, allPoints[i])) {
        const grp = ptFind(i)
        if (!netGroupToComps.has(grp)) netGroupToComps.set(grp, [])
        netGroupToComps.get(grp)!.push(nd.id)
        break
      }
    }
  }

  const edgeSet = new Set<string>()
  for (const [, ids] of netGroupToComps) {
    for (let i = 0; i < ids.length - 1; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join('\x00')
        if (edgeSet.has(key)) continue
        edgeSet.add(key)
        edges.push({ id: `ke${edges.length}`, from: ids[i], to: ids[j] })
      }
    }
  }

  if (nodes.length === 0) throw new Error('No components found in KiCad schematic')
  layoutGraph(nodes, edges)
  return { nodes, edges }
}

function kicadLibIdToType(libId: string, ref: string): ComponentType {
  const lower = libId.toLowerCase()
  if (lower.includes(':r') || ref.startsWith('R')) return 'resistor'
  if (lower.includes(':c') || ref.startsWith('C')) return 'capacitor'
  if (lower.includes(':l') || ref.startsWith('L')) return 'inductor'
  if (lower.includes('led') || ref.startsWith('D')) return 'led'
  if (lower.includes('diode')) return 'diode'
  if (lower.includes('vcc') || lower.includes('pwr_flag') || lower.includes('vbatt') || ref.startsWith('V')) return 'voltageSource'
  if (lower.includes('gnd') || lower.includes('ground')) return 'ground'
  if (lower.includes('sw') || ref.startsWith('SW')) return 'switch'
  return 'resistor'
}

function parseSpiceValue(s: string): number {
  const SCALE: Record<string, number> = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3, k: 1e3, meg: 1e6, g: 1e9, t: 1e12 }
  const m = s.match(/^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)\s*([a-z]*)/i)
  if (!m) return NaN
  const num = parseFloat(m[1])
  const suffix = m[2].toLowerCase()
  const scale = SCALE[suffix] ?? (suffix.startsWith('meg') ? 1e6 : 1)
  return num * scale
}

/* ================================================================== */
/*  CDDX XML parser                                                    */
/* ================================================================== */

function parseCddxXml(xml: string): CircuitGraph {
  const nodes: CircuitNode[] = []
  const edges: CircuitEdge[] = []
  const edgeSet = new Set<string>()
  const defs = new Map<string, string>()
  const defRe = /<add\s[^>]*id="(\d+)"[^>]*item="([^"]+)"/gi
  let m: RegExpExecArray | null
  while ((m = defRe.exec(xml)) !== null) defs.set(m[1], m[2].toLowerCase())
  const compRe = /<c\s([^>]*)>([\s\S]*?)<\/c>/gi
  const cnBuckets = new Map<string, string[]>()
  while ((m = compRe.exec(xml)) !== null) {
    const attrs = m[1], body = m[2]
    const id = attr(attrs, 'id') ?? `c${Math.random().toString(36).slice(2, 7)}`
    const tp = attr(attrs, 'tp') ?? ''
    const x = parseInt(attr(attrs, 'x') ?? '0', 10)
    const y = parseInt(attr(attrs, 'y') ?? '0', 10)
    const refMatch = tp.match(/\{(\d+)\}/)
    const typeName = refMatch ? defs.get(refMatch[1]) ?? tp : tp.toLowerCase()
    const type = mapType(typeName)
    let value: number | undefined
    const pRe = /<p\s[^>]*k="([^"]+)"[^>]*v="([^"]*)"/gi
    let pm: RegExpExecArray | null
    while ((pm = pRe.exec(body)) !== null) {
      if (pm[1] === 'resistance') value = parseFloat(pm[2])
      if (pm[1] === 'capacitance') value = parseFloat(pm[2]) * 1e-6
      if (pm[1] === 'voltage') value = parseFloat(pm[2])
    }
    const cid = `cddx_${id}`
    nodes.push({ id: cid, type, value, position: { x, y } })
    const cnRe = /<cn\s[^>]*id="(\d+)"/gi
    let cm: RegExpExecArray | null
    while ((cm = cnRe.exec(body)) !== null) {
      if (!cnBuckets.has(cm[1])) cnBuckets.set(cm[1], [])
      cnBuckets.get(cm[1])!.push(cid)
    }
  }
  for (const [, ids] of cnBuckets) {
    for (let i = 0; i < ids.length - 1; i++) {
      const key = [ids[i], ids[i + 1]].sort().join('\x00')
      if (edgeSet.has(key)) continue
      edgeSet.add(key)
      edges.push({ id: `e${edges.length}`, from: ids[i], to: ids[i + 1] })
    }
  }
  return { nodes, edges }
}

function attr(s: string, name: string): string | undefined {
  const m = new RegExp(`${name}="([^"]*)"`, 'i').exec(s)
  return m ? m[1] : undefined
}

/* ================================================================== */
/*  SPICE / LTspice netlist parser (.asc, .net, .cir)                 */
/* ================================================================== */

function parseSpiceText(text: string): CircuitGraph {
  const rawLines = text.split(/\r?\n/)
  const lines: string[] = []
  for (const r of rawLines) {
    if (r.startsWith('+') && lines.length) lines[lines.length - 1] += ' ' + r.slice(1).trim()
    else lines.push(r)
  }

  const nodes: CircuitNode[] = []
  const nodeToIds = new Map<string, string[]>()
  const gndNodes = new Set(['0', 'gnd', 'GND'])
  let needsGround = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || i === 0 || line.startsWith('*') || line.startsWith(';') || line.startsWith('.')) continue
    const tokens = line.split(/[\s,]+/).filter(Boolean)
    if (tokens.length < 3) continue
    const prefix = tokens[0][0].toUpperCase()
    const parsed = parseLine(prefix, tokens)
    if (!parsed) continue
    const nid = `sp_${tokens[0]}`
    nodes.push({ id: nid, type: parsed.type, value: parsed.value, position: { x: 0, y: 0 } })
    for (const nd of parsed.spiceNodes) {
      if (gndNodes.has(nd)) { needsGround = true; continue }
      if (!nodeToIds.has(nd)) nodeToIds.set(nd, [])
      nodeToIds.get(nd)!.push(nid)
    }
    if (parsed.spiceNodes.some(nd => gndNodes.has(nd))) {
      if (!nodeToIds.has('__gnd__')) nodeToIds.set('__gnd__', [])
      nodeToIds.get('__gnd__')!.push(nid)
    }
  }

  if (needsGround) {
    nodes.push({ id: 'sp_GND', type: 'ground', position: { x: 0, y: 0 } })
    if (!nodeToIds.has('__gnd__')) nodeToIds.set('__gnd__', [])
    nodeToIds.get('__gnd__')!.push('sp_GND')
  }

  const edges: CircuitEdge[] = []
  const es = new Set<string>()
  const addE = (a: string, b: string) => {
    const k = [a, b].sort().join('\x00')
    if (es.has(k)) return
    es.add(k)
    edges.push({ id: `e${edges.length}`, from: a, to: b })
  }
  for (const [nid, ids] of nodeToIds) {
    if (ids.length < 2) continue
    if (nid === '__gnd__') { for (const c of ids) { if (c !== 'sp_GND') addE(c, 'sp_GND') } }
    else { for (let i = 0; i < ids.length - 1; i++) addE(ids[i], ids[i + 1]) }
  }

  layoutGraph(nodes, edges)
  return { nodes, edges }
}

interface PL { type: ComponentType; spiceNodes: string[]; value?: number }
function parseLine(prefix: string, tokens: string[]): PL | null {
  const two = (t: ComponentType): PL => ({ type: t, spiceNodes: [tokens[1], tokens[2]], value: tokens[3] ? parseSpiceValue(tokens[3]) : undefined })
  switch (prefix) {
    case 'R': return two('resistor')
    case 'C': return two('capacitor')
    case 'L': return two('inductor')
    case 'D': return two('diode')
    case 'S': return { type: 'switch', spiceNodes: [tokens[1], tokens[2]], value: undefined, ...{ isOn: true } }
    case 'I': return two('currentSource')
    case 'V': {
      const spiceNodes = [tokens[1], tokens[2]]
      let value: number | undefined
      for (let i = 3; i < tokens.length; i++) {
        if (/^(DC|AC)$/i.test(tokens[i])) continue
        const v = parseSpiceValue(tokens[i])
        if (!isNaN(v) && v !== 0) { value = Math.abs(v); break }
      }
      return { type: 'voltageSource', spiceNodes, value: value ?? 9 }
    }
    case 'M': return { type: 'resistor', spiceNodes: tokens.slice(1, 5).filter(Boolean), value: undefined }
    case 'Q': return { type: 'resistor', spiceNodes: tokens.slice(1, 4).filter(Boolean), value: undefined }
    default: return null
  }
}

const TYPE_KW: [RegExp, ComponentType][] = [
  [/resistor/i, 'resistor'], [/capacitor/i, 'capacitor'], [/inductor/i, 'inductor'],
  [/(?:led)/i, 'led'], [/diode/i, 'diode'],
  [/(?:battery|cell|voltage)/i, 'voltageSource'], [/current.source/i, 'currentSource'],
  [/switch/i, 'switch'], [/(?:ground|earth)/i, 'ground'],
]
function mapType(name: string): ComponentType {
  for (const [re, ct] of TYPE_KW) if (re.test(name)) return ct
  return 'resistor'
}

function layoutGraph(nodes: CircuitNode[], edges: CircuitEdge[]) {
  if (nodes.length === 0) return
  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of edges) {
    adj.get(e.from)?.push(e.to)
    adj.get(e.to)?.push(e.from)
  }
  const start = (nodes.find(n => n.type === 'voltageSource') ?? nodes[0]).id
  const visited = new Set<string>()
  const order: string[] = []
  const queue = [start]
  visited.add(start)
  while (queue.length > 0) {
    const cur = queue.shift()!
    order.push(cur)
    for (const nb of adj.get(cur) ?? []) {
      if (!visited.has(nb)) { visited.add(nb); queue.push(nb) }
    }
  }
  for (const n of nodes) if (!visited.has(n.id)) order.push(n.id)
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  for (let i = 0; i < order.length; i++) {
    const n = nodeMap.get(order[i])
    if (n) n.position = { x: 50 + i * 200, y: 150 }
  }
}
