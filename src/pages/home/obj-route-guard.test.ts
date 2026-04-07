import { describe, expect, it } from "vitest"
import { isActiveSessionRouteAligned } from "./obj-route-guard"

describe("isActiveSessionRouteAligned", () => {
  it("returns true only when the active session route matches the current route", () => {
    expect(
      isActiveSessionRouteAligned(
        {
          pathname: "/folder",
          search: "?view=list",
        },
        "/folder",
        "?view=list",
      ),
    ).toBe(true)

    expect(
      isActiveSessionRouteAligned(
        {
          pathname: "/folder",
          search: "?view=list",
        },
        "/other",
        "?view=list",
      ),
    ).toBe(false)

    expect(
      isActiveSessionRouteAligned(
        {
          pathname: "/folder",
          search: "?view=list",
        },
        "/folder",
        "",
      ),
    ).toBe(false)

    expect(isActiveSessionRouteAligned(undefined, "/folder", "")).toBe(false)
  })

  it("ignores pwd when aligning the active session route", () => {
    expect(
      isActiveSessionRouteAligned(
        {
          pathname: "/folder",
          search: "?view=list",
        },
        "/folder",
        "?pwd=secret&view=list",
      ),
    ).toBe(true)
  })

  it("ignores preview and canonicalizes query order when aligning routes", () => {
    expect(
      isActiveSessionRouteAligned(
        {
          pathname: "/folder/file.mp4",
          search: "?page=2&view=list",
        },
        "/folder/file.mp4",
        "?preview=video&view=list&page=2",
      ),
    ).toBe(true)
  })
})
