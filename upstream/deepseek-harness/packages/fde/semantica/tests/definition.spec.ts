import { expect, it } from 'vitest'
import { parseSemanticDefinition } from '../src/definition.ts'

const draft = {
  version: '1', classes: [], relationships: [], competencyQuestions: [], provenanceRules: [], temporalRules: [],
  confidenceThreshold: .65, shaclSeverity: 'Violation',
}

it('accepts editable fields but rejects caller-owned publication and malformed property definitions', () => {
  expect(parseSemanticDefinition(draft)).toEqual(draft)
  for (const field of ['status', 'revision', 'digest', 'updatedAt']) {
    expect(() => parseSemanticDefinition({ ...draft, [field]: 'published' })).toThrow('由系统维护')
  }
  expect(() => parseSemanticDefinition({ ...draft, classes: [{}] })).toThrow()
  expect(() => parseSemanticDefinition({ ...draft, shaclSeverity: 'passed' })).toThrow()
  expect(() => parseSemanticDefinition({ ...draft, competencyQuestions: [{ id: 'q', text: 'q', required: true, query: { kind: 'magic', maxDepth: 1, minAnswers: 1 } }] })).toThrow()
})
