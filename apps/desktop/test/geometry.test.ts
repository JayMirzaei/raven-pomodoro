import { describe, expect, it } from 'vitest'
import { clampToArea, defaultPosition, dragTarget } from '../src/core/geometry'

const area = { x: 0, y: 0, width: 1920, height: 1040 }

describe('defaultPosition', () => {
  it('is the bottom-right corner, inset by the margin', () => {
    expect(defaultPosition(area, 192, 24)).toEqual({ x: 1704, y: 824 })
  })

  it('respects a work area that does not start at the origin (e.g. a left-hand taskbar)', () => {
    expect(defaultPosition({ x: 60, y: 0, width: 1860, height: 1080 }, 192, 24)).toEqual({ x: 1704, y: 864 })
  })
})

describe('clampToArea', () => {
  it('leaves a position that fits alone', () => {
    expect(clampToArea({ x: 100, y: 200 }, area, 192)).toEqual({ x: 100, y: 200 })
  })

  it('pulls a position from a larger or removed display back on screen', () => {
    expect(clampToArea({ x: 3000, y: -50 }, area, 192)).toEqual({ x: 1728, y: 0 })
    expect(clampToArea({ x: -400, y: 2000 }, area, 192)).toEqual({ x: 0, y: 848 })
  })
})

describe('dragTarget', () => {
  it('moves the window by the cursor delta, in whole pixels', () => {
    expect(dragTarget({ x: 100, y: 100 }, { x: 500, y: 500 }, { x: 530.6, y: 480.2 })).toEqual({ x: 131, y: 80 })
  })
})
