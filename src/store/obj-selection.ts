import type { StoreObj } from "~/types"

export type SelectionRangeState = {
  start: number
  end: number
}

export const createEmptySelectionRange = (): SelectionRangeState => ({
  start: -1,
  end: -1,
})

export const clearSelectionRange = (): SelectionRangeState =>
  createEmptySelectionRange()

export const toggleSingleSelection = (
  index: number,
  checked: boolean,
): SelectionRangeState => {
  if (checked) {
    return {
      start: index,
      end: index,
    }
  }
  return clearSelectionRange()
}

export const resolveSelectionAnchor = (
  objs: StoreObj[],
  index: number,
  current: SelectionRangeState,
) => {
  if (current.start >= 0) {
    return current
  }
  for (let i = 0; i < Math.max(index + 1, objs.length - index); ++i) {
    if (objs[index - i]?.selected) {
      return {
        start: index - i,
        end: index - i,
      }
    }
    if (objs[index + i]?.selected) {
      return {
        start: index + i,
        end: index + i,
      }
    }
  }
  return {
    start: index,
    end: index,
  }
}

export const buildRangeSelection = (
  index: number,
  current: SelectionRangeState,
) => {
  const uncheckCount = Math.abs(current.end - current.start)
  const uncheckSign = Math.sign(current.end - current.start)
  const checkCount = Math.abs(index - current.start)
  const checkSign = Math.sign(index - current.start)
  return {
    nextRange: {
      start: current.start,
      end: index,
    },
    uncheckIndexes: Array.from(
      { length: uncheckCount },
      (_, offset) => current.start + uncheckSign * (offset + 1),
    ),
    checkIndexes: Array.from(
      { length: checkCount + 1 },
      (_, offset) => current.start + checkSign * offset,
    ),
  }
}

export const getSelectedObjects = (objs: StoreObj[]) =>
  objs.filter((obj) => obj.selected)
