import { describe, expect, it } from "vitest"
import { bus } from "~/utils/bus"
import { createPathSessionRecordController } from "./path-session-record"

describe("path session record", () => {
  it("tracks known directories per session and resolves pushed paths", () => {
    let sessionId = "a"
    let pathname = "/root"
    const controller = createPathSessionRecordController({
      getSessionId: () => sessionId,
      getPathname: () => pathname,
    })

    controller.setPathAs("/alpha")
    controller.setPathAs("child", true, true)

    expect(controller.getDirRecord()).toEqual({
      "/alpha": true,
      "/root/child": true,
    })

    controller.setPathAs("/alpha", false)
    expect(controller.getDirRecord()).toEqual({
      "/root/child": true,
    })

    sessionId = "b"
    pathname = "/other"
    expect(controller.getDirRecord()).toEqual({})

    bus.emit("file_session_closed", "a")
  })

  it("clones known directories into a duplicated session", () => {
    let sessionId = "a"
    const controller = createPathSessionRecordController({
      getSessionId: () => sessionId,
      getPathname: () => "/root",
    })

    controller.setPathAs("/alpha")
    bus.emit("file_session_cloned", {
      sourceSessionId: "a",
      sessionId: "b",
    })

    sessionId = "b"
    expect(controller.getDirRecord()).toEqual({
      "/alpha": true,
    })
  })

  it("clears known directories when the workspace password changes", () => {
    let sessionId = "a"
    const controller = createPathSessionRecordController({
      getSessionId: () => sessionId,
      getPathname: () => "/root",
    })

    controller.setPathAs("/alpha")
    expect(controller.getDirRecord()).toEqual({
      "/alpha": true,
    })

    bus.emit("file_session_password_changed", "a")
    expect(controller.getDirRecord()).toEqual({})
  })
})
