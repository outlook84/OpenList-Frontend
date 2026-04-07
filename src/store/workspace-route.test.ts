import { describe, expect, it } from "vitest"
import {
  getUrlPassword,
  isSameWorkspaceRoute,
  normalizeFolderRouteSearch,
  sanitizeWorkspaceSearch,
} from "./workspace-route"

describe("workspace route normalization", () => {
  it("ignores preview and canonicalizes workspace query params", () => {
    expect(
      sanitizeWorkspaceSearch("?view=list&preview=video&page=2&pwd=secret"),
    ).toBe("?page=2&view=list")
    expect(sanitizeWorkspaceSearch("?page=2&view=list")).toBe(
      "?page=2&view=list",
    )
  })

  it("keeps only folder-scoped params in canonical order", () => {
    expect(
      normalizeFolderRouteSearch(
        "?preview=video&view=list&from=search&page=2&pwd=secret",
      ),
    ).toBe("?page=2&view=list")
  })

  it("returns a password only when the URL explicitly provides a non-empty pwd", () => {
    expect(getUrlPassword("?pwd=secret&view=list")).toBe("secret")
    expect(getUrlPassword("?view=list")).toBeUndefined()
    expect(getUrlPassword("?pwd=&view=list")).toBeUndefined()
  })

  it("compares workspace routes using sanitized route identity", () => {
    expect(
      isSameWorkspaceRoute(
        "/share/demo",
        "?pwd=secret&preview=video&view=list",
        "/share/demo",
        "?view=list",
      ),
    ).toBe(true)

    expect(
      isSameWorkspaceRoute(
        "/folder",
        "?view=list&page=2",
        "/folder",
        "?page=2&view=list",
      ),
    ).toBe(true)

    expect(
      isSameWorkspaceRoute("/folder", "?view=list", "/other", "?view=list"),
    ).toBe(false)
  })
})
