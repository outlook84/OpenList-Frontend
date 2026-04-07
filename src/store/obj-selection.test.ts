import { describe, expect, it } from "vitest"
import {
  buildRangeSelection,
  clearSelectionRange,
  createEmptySelectionRange,
  getSelectedObjects,
  resolveSelectionAnchor,
  toggleSingleSelection,
} from "./obj-selection"

describe("obj selection helpers", () => {
  it("creates and clears empty ranges", () => {
    expect(createEmptySelectionRange()).toEqual({ start: -1, end: -1 })
    expect(clearSelectionRange()).toEqual({ start: -1, end: -1 })
  })

  it("toggles a single selection range", () => {
    expect(toggleSingleSelection(3, true)).toEqual({ start: 3, end: 3 })
    expect(toggleSingleSelection(3, false)).toEqual({ start: -1, end: -1 })
  })

  it("resolves selection anchor from nearby selected items", () => {
    const objs = [
      { selected: false },
      { selected: false },
      { selected: true },
      { selected: false },
    ] as { selected?: boolean }[]

    expect(
      resolveSelectionAnchor(objs as never, 3, { start: -1, end: -1 }),
    ).toEqual({ start: 2, end: 2 })
  })

  it("builds range selection indexes for uncheck and check passes", () => {
    expect(buildRangeSelection(5, { start: 2, end: 4 })).toEqual({
      nextRange: { start: 2, end: 5 },
      uncheckIndexes: [3, 4],
      checkIndexes: [2, 3, 4, 5],
    })
  })

  it("filters selected objects", () => {
    expect(
      getSelectedObjects([
        { name: "a", selected: true },
        { name: "b", selected: false },
        { name: "c", selected: true },
      ] as never),
    ).toEqual([
      { name: "a", selected: true },
      { name: "c", selected: true },
    ])
  })
})
