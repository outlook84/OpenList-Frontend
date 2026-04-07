import { describe, expect, it, vi } from "vitest"

vi.mock("~/store", () => ({
  objStore: {
    state: "folder",
    obj: { name: "current.txt" },
  },
  password: () => "session-secret",
  selectedObjs: () => [],
  State: {
    File: "file",
  },
  me: () => ({
    base_path: "/base",
  }),
}))

vi.mock("~/utils", () => ({
  api: "https://api.example",
  base_path: "",
  encodePath: (value: string) => value,
  pathDir: (value: string) => value.split("/").slice(0, -1).join("/") || "/",
  pathJoin: (...parts: string[]) =>
    parts.join("/").replace(/\/+/g, "/").replace(":/", "://"),
  standardizePath: (value: string) => value,
}))

vi.mock("./useRouter", () => ({
  useRouter: () => ({
    pathname: () => "/@s/demo",
    isShare: () => true,
  }),
}))

vi.mock("./useUtil", () => ({
  useUtil: () => ({
    copy: vi.fn(),
  }),
}))

import { getLinkByDirAndObj, useLink } from "./useLink"

describe("useLink", () => {
  it("builds share links with the active workspace password", () => {
    const { rawLink } = useLink()

    expect(rawLink({ name: "file.txt" } as never)).toBe(
      "https://api.example/sd/demo/file.txt?pwd=session-secret",
    )
  })

  it("only appends a share password when one is explicitly provided", () => {
    expect(
      getLinkByDirAndObj(
        "/@s/demo",
        { name: "file.txt" } as never,
        "direct",
        true,
        true,
        "",
      ),
    ).toBe("https://api.example/sd/demo/file.txt")
  })
})
