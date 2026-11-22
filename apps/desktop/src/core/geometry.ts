// Pure window-placement maths for the widget, kept free of Electron so it
// can be unit-tested. src/main/window.ts and src/main/ipc.ts feed it the
// real screen and cursor values.

export interface Point {
  x: number
  y: number
}

export interface Rect extends Point {
  width: number
  height: number
}

/** Bottom-right corner of the work area, `margin` px in from both edges. */
export function defaultPosition(workArea: Rect, size: number, margin: number): Point {
  return {
    x: workArea.x + workArea.width - size - margin,
    y: workArea.y + workArea.height - size - margin
  }
}

/**
 * Keeps a square window of `size` px fully inside the work area, so a
 * position saved on a larger or since-removed display cannot strand the
 * widget off screen.
 */
export function clampToArea(pos: Point, area: Rect, size: number): Point {
  return {
    x: Math.min(Math.max(pos.x, area.x), area.x + area.width - size),
    y: Math.min(Math.max(pos.y, area.y), area.y + area.height - size)
  }
}

/** Where the window goes when the cursor has moved from `cursorStart` to `cursor`. */
export function dragTarget(windowStart: Point, cursorStart: Point, cursor: Point): Point {
  return {
    x: Math.round(windowStart.x + (cursor.x - cursorStart.x)),
    y: Math.round(windowStart.y + (cursor.y - cursorStart.y))
  }
}
