import { beforeEach, describe, expect, it, vi } from "vitest"
import { createComponent, createRoot } from "solid-js"

const hookMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: vi.fn(() => "/folder/video-2.mp4"),
  currentObjLink: vi.fn(() => "https://example.com/video-2.mp4"),
  handleFolder: vi.fn(),
  t: vi.fn((key: string) => key),
  getCurrentWorkspacePage: vi.fn((pathname: string) =>
    pathname === "/folder" ? 4 : 1,
  ),
}))

const storeMocks = vi.hoisted(() => ({
  getPagination: vi.fn(() => ({ type: "load_more", size: 20 })),
  objStore: {
    objs: [
      { name: "video-1.mp4", type: "video" },
      { name: "video-2.mp4", type: "video" },
    ],
    obj: { name: "video-2.mp4" },
    raw_url: "https://example.com/raw/video-2.mp4",
  },
}))

vi.mock("@hope-ui/solid", () => {
  const passthrough = (props: { children?: unknown }) => props.children
  return {
    Flex: passthrough,
    VStack: passthrough,
    Image: () => null,
    Anchor: passthrough,
    Tooltip: passthrough,
    HStack: passthrough,
    Switch: passthrough,
    Icon: () => null,
    IconButton: () => null,
  }
})

vi.mock("~/hooks", () => ({
  useRouter: () => ({
    replace: hookMocks.replace,
    pathname: hookMocks.pathname,
  }),
  useLink: () => ({
    currentObjLink: hookMocks.currentObjLink,
  }),
  useT: () => hookMocks.t,
  usePath: () => ({
    handleFolder: hookMocks.handleFolder,
  }),
  getCurrentWorkspacePage: hookMocks.getCurrentWorkspacePage,
}))

vi.mock("~/store", () => ({
  getPagination: storeMocks.getPagination,
  objStore: storeMocks.objStore,
}))

vi.mock("~/utils", () => ({
  convertURL: vi.fn(() => "#"),
  getPlatform: vi.fn(() => "Unknown"),
}))

vi.mock("~/components", () => ({
  SelectWrapper: () => null,
}))

vi.mock("artplayer", () => ({
  default: class Artplayer {},
}))

vi.mock("solid-icons/bs", () => ({
  BsArrowRight: () => null,
}))

describe("VideoBox integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookMocks.pathname.mockReturnValue("/folder/video-2.mp4")
    hookMocks.getCurrentWorkspacePage.mockImplementation((pathname: string) =>
      pathname === "/folder" ? 4 : 1,
    )
    storeMocks.getPagination.mockReturnValue({ type: "load_more", size: 20 })
    storeMocks.objStore.objs = [
      { name: "video-1.mp4", type: "video" },
      { name: "video-2.mp4", type: "video" },
    ]
    storeMocks.objStore.obj = { name: "video-2.mp4" }
    storeMocks.objStore.raw_url = "https://example.com/raw/video-2.mp4"
    const localStorageStore = new Map<string, string>()
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        __dynamic_base__: "",
      },
    })
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {
        pathname: "/folder/video-2.mp4",
        search: "?view=list",
      },
    })
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => localStorageStore.get(key) ?? null,
        setItem: (key: string, value: string) =>
          localStorageStore.set(key, value),
        clear: () => localStorageStore.clear(),
      },
    })
  })

  it("loads the next folder page when the current video is the last loaded preview item", async () => {
    const { VideoBox } = await import("./video_box")
    createRoot((dispose) => {
      createComponent(VideoBox, {
        onAutoNextChange: vi.fn(),
        get children() {
          return null
        },
      })

      expect(hookMocks.getCurrentWorkspacePage).toHaveBeenCalledWith(
        "/folder",
        "?view=list",
      )
      expect(hookMocks.handleFolder).toHaveBeenCalledWith(
        "/folder",
        5,
        undefined,
        true,
        false,
        true,
        "?view=list",
      )

      dispose()
    })
  })

  it("normalizes file-only query params before continuing folder pagination", async () => {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {
        pathname: "/folder/video-2.mp4",
        search:
          "?preview=video&auto_fullscreen=true&type=audio&from=search&view=list&page=3",
      },
    })

    const { VideoBox } = await import("./video_box")
    createRoot((dispose) => {
      createComponent(VideoBox, {
        onAutoNextChange: vi.fn(),
        get children() {
          return null
        },
      })

      expect(hookMocks.getCurrentWorkspacePage).toHaveBeenCalledWith(
        "/folder",
        "?page=3&view=list",
      )
      expect(hookMocks.handleFolder).toHaveBeenCalledWith(
        "/folder",
        5,
        undefined,
        true,
        false,
        true,
        "?page=3&view=list",
      )

      dispose()
    })
  })

  it("keeps loading from the root folder for top-level videos", async () => {
    hookMocks.pathname.mockReturnValue("/video-2.mp4")
    hookMocks.getCurrentWorkspacePage.mockImplementation((pathname: string) =>
      pathname === "/" ? 2 : 1,
    )
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {
        pathname: "/video-2.mp4",
        search: "?view=list",
      },
    })

    const { VideoBox } = await import("./video_box")
    createRoot((dispose) => {
      createComponent(VideoBox, {
        onAutoNextChange: vi.fn(),
        get children() {
          return null
        },
      })

      expect(hookMocks.getCurrentWorkspacePage).toHaveBeenCalledWith(
        "/",
        "?view=list",
      )
      expect(hookMocks.handleFolder).toHaveBeenCalledWith(
        "/",
        3,
        undefined,
        true,
        false,
        true,
        "?view=list",
      )

      dispose()
    })
  })
})
