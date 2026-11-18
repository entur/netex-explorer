import { describe, it, expect } from 'vitest'
import { fixture } from './fixture'
import { rootNodes, childNodes, opensElement, type TreeNode } from '../structureTree'

const stopPlace = fixture.elements.find((e) => e.name === 'StopPlace')!
const quay = fixture.elements.find((e) => e.name === 'Quay')!

describe('rootNodes', () => {
  it('rootNodes inserts divider on origin change', () => {
    const nodes = rootNodes(stopPlace, fixture)
    const dividers = nodes.filter((n) => n.kind === 'divider').map((n) => (n as { origin: string }).origin)
    expect(dividers).toEqual(['Entity', 'StopPlace', 'Zone', 'StopPlace', 'DataManagedObject', 'Site'])
    expect(nodes[0]).toEqual({ kind: 'divider', origin: 'Entity' })
  })

  it('rootNodes groups choice members', () => {
    const choices = rootNodes(stopPlace, fixture).filter((n) => n.kind === 'choice')
    expect(choices).toHaveLength(1)
    const c = choices[0] as Extract<TreeNode, { kind: 'choice' }>
    expect(c.children.map((n) => (n.kind === 'field' ? n.field.name : ''))).toEqual(['Name', 'ShortName'])
    expect(c.maxOccurs).toBe('1')
  })

  it('has unique ids', () => {
    const ids: string[] = []
    const walk = (ns: TreeNode[]) =>
      ns.forEach((n) => {
        if (n.kind === 'divider') return
        ids.push(n.id)
        if (n.kind === 'choice') walk(n.children)
      })
    walk(rootNodes(stopPlace, fixture))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('childNodes', () => {
  const quays = rootNodes(stopPlace, fixture).find((n) => n.kind === 'field' && n.field.name === 'quays')!

  it('childNodes of quays lists Quay and QuayRef', () => {
    expect(quays.kind === 'field' && quays.expandable).toBe(true)
    const kids = childNodes(quays, fixture, ['StopPlace'])
    expect(kids.map((k) => (k.kind === 'element' ? k.name : ''))).toEqual(['QuayRef', 'Quay'])
    const [ref, q] = kids as Extract<TreeNode, { kind: 'element' }>[]
    expect(ref.expandable).toBe(false) // finnes ikke i data.elements
    expect(q.expandable).toBe(true)
  })

  it('recursive element is marked cycle', () => {
    const quayQuays = rootNodes(quay, fixture).find((n) => n.kind === 'field' && n.field.name === 'quays')!
    const [child] = childNodes(quayQuays, fixture, ['StopPlace', 'Quay'])
    expect(child).toMatchObject({ kind: 'element', name: 'Quay', cycle: true, expandable: false })
  })

  it('complex field expands to its structure; element expands to its fields', () => {
    const keyList = rootNodes(stopPlace, fixture).find((n) => n.kind === 'field' && n.field.name === 'keyList')!
    const kids = childNodes(keyList, fixture, ['StopPlace'])
    expect(kids.some((k) => k.kind === 'field' && k.field.name === 'KeyValue')).toBe(true)
    const [, q] = childNodes(quays, fixture, ['StopPlace'])
    expect(childNodes(q, fixture, ['StopPlace', 'Quay']).some((k) => k.kind === 'field' && k.field.name === 'quays')).toBe(true)
  })

  it('complex without known structure is not expandable', () => {
    const keyList = rootNodes(stopPlace, { ...fixture, structures: {} }).find((n) => n.kind === 'field' && n.field.name === 'keyList')!
    expect(keyList.kind === 'field' && keyList.expandable).toBe(false)
  })
})

describe('fieldNodes dividers', () => {
  it('emits no orphan divider for a field absorbed into an earlier choice', () => {
    const f = (name: string, origin: string, choice?: string) => ({
      ...stopPlace.fields[0], name, origin, isAttribute: false, choice: choice ? { id: choice, minOccurs: '0', maxOccurs: '1' } : undefined,
    })
    const el = { ...stopPlace, fields: [f('a', 'X'), f('n1', 'Y', 'c'), f('b', 'X'), f('n2', 'Y', 'c'), f('d', 'X')] }
    const dividers = rootNodes(el, fixture).filter((n) => n.kind === 'divider').map((n) => (n as { origin: string }).origin)
    expect(dividers).toEqual(['X', 'Y', 'X'])
  })
})

describe('abstract heads, local elements and element refs', () => {
  const fareZone = fixture.elements.find((e) => e.name === 'FareZone')!
  const roots = rootNodes(fareZone, fixture)
  const fieldNode = (name: string) => roots.find((n) => n.kind === 'field' && n.field.name === name) as Extract<TreeNode, { kind: 'field' }>
  type El = Extract<TreeNode, { kind: 'element' }>

  it('contains: head with members, local entries by type, unknown refs plain', () => {
    const kids = childNodes(fieldNode('validityConditions'), fixture, ['FareZone']) as El[]
    expect(kids[0]).toMatchObject({ name: 'ValidityCondition_Dummy', label: 'ValidityCondition', ref: true, abstract: true, members: ['Line', 'Quay'], expandable: true })
    expect(kids[1]).toMatchObject({ name: 'Extra', ref: false, type: 'KeyListStructure', abstract: false, expandable: true })
    expect(kids[2]).toMatchObject({ name: 'Plain', ref: false, type: 'xsd:string', expandable: false })
    expect(kids[3]).toMatchObject({ name: 'Ghost', ref: true, abstract: false, expandable: false })
  })

  it('a head expands to its member elements, with cycle rules', () => {
    const [head, local] = childNodes(fieldNode('validityConditions'), fixture, ['FareZone']) as El[]
    const members = childNodes(head, fixture, ['FareZone', 'Quay']) as El[]
    expect(members.map((m) => [m.name, m.ref, m.expandable, m.cycle])).toEqual([
      ['Line', true, true, false],
      ['Quay', true, false, true],
    ])
    expect(childNodes(local, fixture, ['FareZone']).some((k) => k.kind === 'field' && k.field.name === 'KeyValue')).toBe(true)
  })

  it('a stripped _Dummy name is never linked to the concrete element', () => {
    const f = { ...fieldNode('validityConditions').field, contains: [{ name: 'Quay_Dummy', minOccurs: '0', maxOccurs: '1', ref: true }] }
    const [kid] = childNodes({ kind: 'field', id: 'x', field: f, expandable: true }, fixture, ['FareZone']) as El[]
    expect(kid).toMatchObject({ name: 'Quay_Dummy', label: 'Quay', abstract: false, expandable: false })
  })

  it('a field that refs an abstract head expands to the members', () => {
    const head = fieldNode('TariffZoneRef_Dummy')
    expect(head.expandable).toBe(true)
    expect((childNodes(head, fixture, ['FareZone']) as El[]).map((m) => m.name)).toEqual(['Line'])
  })

  it('a field that refs a concrete element expands to the element fields unless it is in the path', () => {
    const fp = fieldNode('FareProduct')
    expect(fp.expandable).toBe(true)
    expect(opensElement(fp)).toBe('FareProduct')
    expect(childNodes(fp, fixture, ['FareZone', 'FareProduct']).map((k) => (k.kind === 'field' ? k.field.name : k.kind))).toContain('id')
    const inCycle = rootNodes(fareZone, fixture, '', ['FareProduct']).find((n) => n.kind === 'field' && n.field.name === 'FareProduct')
    expect(inCycle).toMatchObject({ expandable: false })
  })

  it('unknown and ref fields to concrete elements are not expandable', () => {
    expect(fieldNode('Area').expandable).toBe(false)
    const siteRef = rootNodes(stopPlace, fixture).find((n) => n.kind === 'field' && n.field.name === 'SiteRef')
    expect(siteRef).toMatchObject({ expandable: false })
  })
})
