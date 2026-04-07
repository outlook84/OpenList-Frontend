import { createRoot, createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { createObjLayoutController } from "./obj-layout"

describe("obj layout controller", () => {
  it("reads per-path layout and falls back to the default layout", () => {
    createRoot((dispose) => {
      const [pathname, setPathname] = createSignal("/alpha")
      const [layoutRecord] = createSignal({
        "/alpha": "grid",
      } as Record<string, "list" | "grid" | "image">)
      const controller = createObjLayoutController({
        getPathname: pathname,
        getLayoutRecord: layoutRecord,
        setLayoutRecord: vi.fn(),
        getDefaultLayout: () => "list" as const,
        clone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      })

      expect(controller.layout()).toBe("grid")

      setPathname("/beta")
      expect(controller.layout()).toBe("list")
      dispose()
    })
  })

  it("persists layout changes for the current path", () => {
    createRoot((dispose) => {
      const [layoutRecord, setLayoutRecord] = createSignal<
        Record<string, "list" | "grid" | "image">
      >({})
      const controller = createObjLayoutController({
        getPathname: () => "/alpha",
        getLayoutRecord: layoutRecord,
        setLayoutRecord: setLayoutRecord,
        getDefaultLayout: () => "list" as const,
        clone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      })

      controller.setLayout("image")

      expect(layoutRecord()).toEqual({ "/alpha": "image" })
      expect(controller.layout()).toBe("image")
      dispose()
    })
  })
})
