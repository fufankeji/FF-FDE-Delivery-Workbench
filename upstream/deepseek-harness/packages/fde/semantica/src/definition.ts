/** JSON validation shared by Agent and workbench definition edits. */
import z from '@deepseek-ai/schemastery'
import type { SemanticDefinition } from './types.ts'

const text = z.string().required()
const texts = z.array(z.string()).required()
const rule = z.object({ id: text, label: text, description: text })
const definition = z.object({
  version: text,
  classes: z.array(z.object({
    id: text, label: text, description: z.string(), aliases: texts, identityKeys: texts,
    extractionPatterns: texts,
    properties: z.array(z.object({
      id: text, label: text,
      dataType: z.union(['string', 'number', 'boolean', 'date', 'datetime']).required(),
      required: z.boolean().required(), unique: z.boolean().required(),
    })).required(),
    fieldMappings: z.array(z.object({ sourceField: text, targetProperty: text })).required(),
  })).required(),
  relationships: z.array(z.object({
    id: text, label: text, domain: text, range: text, description: z.string(),
    cardinality: z.union(['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many']).required(),
    extractionPatterns: texts,
  })).required(),
  competencyQuestions: z.array(z.object({
    id: text, text, required: z.boolean().required(),
    query: z.object({
      kind: z.union(['lookup', 'edge', 'path']).required(),
      sourceType: z.string(), relationshipType: z.string(), targetType: z.string(),
      maxDepth: z.number().step(1).min(1).max(8).required(),
      minAnswers: z.number().step(1).min(1).max(1000).required(),
    }).required(),
  })).required(),
  provenanceRules: z.array(rule).required(), temporalRules: z.array(rule).required(),
  confidenceThreshold: z.number().min(0).max(1).required(),
  shaclSeverity: z.union(['Violation', 'Warning', 'Info']).required(),
})

/** Validate editable fields; publication and revision are never accepted from the caller.
 * @param input - Untrusted tool or HTTP JSON.
 * @returns Editable definition fields for the versioned state operation.
 */
export function parseSemanticDefinition(input: unknown): Omit<SemanticDefinition, 'status' | 'revision' | 'digest' | 'updatedAt'> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('本体定义必须是 JSON 对象。')
  for (const field of ['status', 'revision', 'digest', 'updatedAt']) {
    if (field in input) throw new Error(`本体定义的 ${field} 由系统维护，不能提交。`)
  }
  return definition(input)
}
