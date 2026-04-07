import type { StoreObj } from "~/types"
import { keyPressed } from "./key-event"
import {
  buildRangeSelection,
  clearSelectionRange,
  createEmptySelectionRange,
  getSelectedObjects,
  resolveSelectionAnchor,
  toggleSingleSelection,
} from "./obj-selection"

type ObjSelectionControllerDeps = {
  getObjects: () => StoreObj[]
  setSelectedAt: (index: number, checked: boolean) => void
  setAllSelected: (checked: boolean) => void
}

export const createObjSelectionController = (
  deps: ObjSelectionControllerDeps,
) => {
  let lastChecked = createEmptySelectionRange()

  const resetSelectionRange = () => {
    lastChecked = clearSelectionRange()
  }

  const selectIndex = (index: number, checked: boolean, one?: boolean) => {
    if (one) {
      deps.setAllSelected(false)
      resetSelectionRange()
    }
    if (keyPressed["Shift"]) {
      const anchor = resolveSelectionAnchor(
        deps.getObjects(),
        index,
        lastChecked,
      )
      const selection = buildRangeSelection(index, anchor)
      selection.uncheckIndexes.forEach((targetIndex) => {
        deps.setSelectedAt(targetIndex, false)
      })
      selection.checkIndexes.forEach((targetIndex) => {
        deps.setSelectedAt(targetIndex, true)
      })
      lastChecked = selection.nextRange
    } else {
      deps.setSelectedAt(index, checked)
      lastChecked = toggleSingleSelection(index, checked)
    }
  }

  const selectAll = (checked: boolean) => {
    deps.setAllSelected(checked)
    if (!checked) {
      lastChecked = clearSelectionRange()
    }
  }

  const clearSelection = () => {
    deps.setAllSelected(false)
    lastChecked = clearSelectionRange()
  }

  const selectedObjs = () => getSelectedObjects(deps.getObjects())
  const selectedCount = () => selectedObjs().length

  return {
    resetSelectionRange,
    clearSelection,
    selectIndex,
    selectAll,
    selectedObjs,
    allChecked: () => deps.getObjects().length === selectedCount(),
    oneChecked: () => selectedCount() === 1,
    haveSelected: () => selectedCount() > 0,
    isIndeterminate: () =>
      selectedCount() > 0 && selectedCount() < deps.getObjects().length,
  }
}
