import { createRoot } from "solid-js"
import { createStore } from "solid-js/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { StoreObj } from "~/types"
import { keyPressed } from "./key-event"
import { createObjSelectionController } from "./obj-selection-controller"

describe("obj selection controller", () => {
  afterEach(() => {
    delete keyPressed["Shift"]
  })

  it("tracks single selection helpers", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore({
        objs: [
          { name: "a", selected: false },
          { name: "b", selected: false },
        ] as StoreObj[],
      })
      const controller = createObjSelectionController({
        getObjects: () => state.objs,
        setSelectedAt: (index, checked) =>
          setState("objs", index, "selected", checked),
        setAllSelected: (checked) =>
          setState("objs", {}, (obj) => ({ ...obj, selected: checked })),
      })

      controller.selectIndex(1, true)

      expect(controller.selectedObjs()).toEqual([{ name: "b", selected: true }])
      expect(controller.oneChecked()).toBe(true)
      expect(controller.haveSelected()).toBe(true)
      expect(controller.isIndeterminate()).toBe(true)
      dispose()
    })
  })

  it("expands range selection when shift is pressed", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore({
        objs: [
          { name: "a", selected: false },
          { name: "b", selected: false },
          { name: "c", selected: false },
          { name: "d", selected: false },
        ] as StoreObj[],
      })
      const controller = createObjSelectionController({
        getObjects: () => state.objs,
        setSelectedAt: (index, checked) =>
          setState("objs", index, "selected", checked),
        setAllSelected: (checked) =>
          setState("objs", {}, (obj) => ({ ...obj, selected: checked })),
      })

      controller.selectIndex(1, true)
      keyPressed["Shift"] = true
      controller.selectIndex(3, true)

      expect(controller.selectedObjs().map((obj) => obj.name)).toEqual([
        "b",
        "c",
        "d",
      ])
      expect(controller.isIndeterminate()).toBe(true)
      dispose()
    })
  })

  it("clears range tracking when select all is reset", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore({
        objs: [
          { name: "a", selected: true },
          { name: "b", selected: true },
        ] as StoreObj[],
      })
      const controller = createObjSelectionController({
        getObjects: () => state.objs,
        setSelectedAt: (index, checked) =>
          setState("objs", index, "selected", checked),
        setAllSelected: (checked) =>
          setState("objs", {}, (obj) => ({ ...obj, selected: checked })),
      })

      controller.selectAll(false)
      expect(controller.haveSelected()).toBe(false)

      controller.selectIndex(0, true)
      expect(controller.selectedObjs().map((obj) => obj.name)).toEqual(["a"])
      dispose()
    })
  })

  it("clears all selected items explicitly", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore({
        objs: [
          { name: "a", selected: true },
          { name: "b", selected: true },
        ] as StoreObj[],
      })
      const controller = createObjSelectionController({
        getObjects: () => state.objs,
        setSelectedAt: (index, checked) =>
          setState("objs", index, "selected", checked),
        setAllSelected: (checked) =>
          setState("objs", {}, (obj) => ({ ...obj, selected: checked })),
      })

      controller.clearSelection()

      expect(controller.haveSelected()).toBe(false)
      expect(controller.selectedObjs()).toEqual([])
      dispose()
    })
  })
})
