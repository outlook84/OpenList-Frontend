import { createRoot } from "solid-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createObjSessionStore } from "./obj-session-store"

vi.mock("~/utils", () => ({
  bus: {
    emit: vi.fn(),
  },
}))

vi.mock("./local_settings", () => ({
  local: {
    global_default_layout: "list",
  },
}))

vi.mock("nanoid", () => {
  let counter = 0
  return {
    nanoid: () => `${++counter}`,
  }
})

const storageMocks = vi.hoisted(() => {
  const createStorage = () => {
    const storage = new Map<string, string>()
    return {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
      clear: () => {
        storage.clear()
      },
    }
  }

  return {
    cookieStorage: createStorage(),
  }
})

vi.mock("@solid-primitives/storage", () => {
  return {
    cookieStorage: storageMocks.cookieStorage,
    createStorageSignal: (_key: string, initialValue: string) => [
      () => initialValue,
      vi.fn(),
    ],
  }
})

const createSessionStorage = () => {
  const storage = new Map<string, string>()
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
    clear: () => {
      storage.clear()
    },
  }
}

let sessionStorageMock: ReturnType<typeof createSessionStorage>
let localStorageMock: ReturnType<typeof createSessionStorage>

describe("obj session store", () => {
  beforeEach(() => {
    sessionStorageMock = createSessionStorage()
    localStorageMock = createSessionStorage()
    storageMocks.cookieStorage.clear()
    vi.stubGlobal("window", {})
    vi.stubGlobal("location", { pathname: "/" })
    vi.stubGlobal("sessionStorage", sessionStorageMock)
    vi.stubGlobal("localStorage", localStorageMock)
  })

  it("shares one password truth across workspaces in the same share root", () => {
    createRoot((dispose) => {
      const clearSelection = vi.fn()
      const store = createObjSessionStore({ clearSelection })

      const first = store.createAndOpenFileSession(
        "/@s/demo/folder-a",
        "?pwd=alpha&view=list",
      )
      store.setPassword("alpha-pass")
      store.syncTransientLoadMorePage("/@s/demo/folder-a", "?view=list", 3)

      const second = store.createAndOpenFileSession(
        "/@s/demo/folder-b",
        "?pwd=beta&view=list",
      )

      expect(store.password()).toBe("alpha-pass")

      store.setPassword("beta-pass")
      store.syncTransientLoadMorePage("/@s/demo/folder-b", "?view=list", 7)

      store.openFileSession(first.id)

      expect(store.activeFileSessionId()).toBe(first.id)
      expect(store.password()).toBe("beta-pass")
      expect(
        JSON.parse(sessionStorageMock.getItem("route-passwords-v2") || "{}"),
      ).toEqual({
        "/@s/demo": "beta-pass",
      })

      store.openFileSession(second.id)
      expect(store.password()).toBe("beta-pass")
      expect(
        store.getTransientLoadMorePage("/@s/demo/folder-b", "?view=list"),
      ).toBe(7)
      expect(clearSelection).toHaveBeenCalled()
      dispose()
    })
  })

  it("keeps navigation inside the active workspace even when another workspace already owns the route", () => {
    createRoot((dispose) => {
      const store = createObjSessionStore({ clearSelection: vi.fn() })

      const workspaceA = store.createAndOpenFileSession(
        "/workspace-a",
        "?view=list",
      )
      const workspaceB = store.createAndOpenFileSession(
        "/workspace-b",
        "?view=list",
      )

      expect(store.activeFileSessionId()).toBe(workspaceB.id)

      store.syncWorkspaceSession("/workspace-a", "?view=list")

      expect(store.activeFileSessionId()).toBe(workspaceB.id)
      expect(store.activeFileSessionRoute()).toEqual({
        pathname: "/workspace-a",
        search: "?view=list",
      })

      store.openFileSession(workspaceA.id)
      expect(store.activeFileSessionId()).toBe(workspaceA.id)
      expect(store.activeFileSessionRoute()).toEqual({
        pathname: "/workspace-a",
        search: "?view=list",
      })

      dispose()
    })
  })

  it("restores the active workspace password from the new scope-based session storage", () => {
    createRoot((dispose) => {
      const store = createObjSessionStore({ clearSelection: vi.fn() })

      store.syncWorkspaceSession("/@s/demo", "?pwd=session-secret&view=list")
      store.setPassword("session-secret")

      expect(store.password()).toBe("session-secret")
      expect(store.activeFileSessionRoute()).toEqual({
        pathname: "/@s/demo",
        search: "?view=list",
      })
      dispose()
    })

    createRoot((dispose) => {
      const store = createObjSessionStore({ clearSelection: vi.fn() })

      expect(store.password()).toBe("session-secret")
      expect(store.activeFileSessionRoute()).toEqual({
        pathname: "/@s/demo",
        search: "?view=list",
      })
      expect(
        JSON.parse(sessionStorageMock.getItem("route-passwords-v2") || "{}"),
      ).toEqual({
        "/@s/demo": "session-secret",
      })
      dispose()
    })
  })

  it("migrates the legacy browser password into the global password scope", () => {
    storageMocks.cookieStorage.setItem("browser-password", "legacy-secret")

    createRoot((dispose) => {
      const store = createObjSessionStore({ clearSelection: vi.fn() })

      store.syncWorkspaceSession("/folder", "?view=list")
      expect(store.password()).toBe("legacy-secret")

      store.setPassword("")
      expect(store.password()).toBe("")
      expect(storageMocks.cookieStorage.getItem("browser-password")).toBeNull()
      dispose()
    })
  })

  it("duplicates the current workspace state when creating a new session", () => {
    createRoot((dispose) => {
      const store = createObjSessionStore({ clearSelection: vi.fn() })

      const original = store.createAndOpenFileSession("/folder", "?view=list")
      store.setPassword("session-secret")
      store.syncTransientLoadMorePage("/folder", "?view=list", 4)

      const duplicate = store.createAndOpenFileSession("/folder", "?view=list")

      expect(duplicate.id).not.toBe(original.id)
      expect(store.activeFileSessionId()).toBe(duplicate.id)
      expect(store.password()).toBe("session-secret")
      expect(store.getTransientLoadMorePage("/folder", "?view=list")).toBe(4)

      store.openFileSession(original.id)
      expect(store.password()).toBe("session-secret")
      expect(store.getTransientLoadMorePage("/folder", "?view=list")).toBe(4)
      dispose()
    })
  })

  it("persists layout as a durable per-path preference", () => {
    createRoot((dispose) => {
      const store = createObjSessionStore({ clearSelection: vi.fn() })

      store.syncWorkspaceSession("/folder", "?view=list")
      expect(store.layout()).toBe("list")

      store.setLayout("image")
      expect(store.layout()).toBe("image")
      expect(localStorageMock.getItem("layoutRecord")).toBe(
        JSON.stringify({
          "/folder": "image",
        }),
      )

      store.createAndOpenFileSession("/other", "?view=list")
      expect(store.layout()).toBe("list")

      store.syncWorkspaceSession("/folder", "?view=list")
      expect(store.layout()).toBe("image")
      dispose()
    })

    createRoot((dispose) => {
      const store = createObjSessionStore({ clearSelection: vi.fn() })

      store.syncWorkspaceSession("/folder", "?view=list")
      expect(store.layout()).toBe("image")
      dispose()
    })
  })

  it("keeps load-more progress per route while staying in the same workspace", () => {
    createRoot((dispose) => {
      const store = createObjSessionStore({ clearSelection: vi.fn() })

      store.createAndOpenFileSession("/folder", "")
      store.syncTransientLoadMorePage("/folder", "", 4)

      store.syncWorkspaceSession("/folder/file.mp4", "")
      expect(store.getTransientLoadMorePage("/folder/file.mp4", "")).toBe(1)

      store.syncWorkspaceSession("/folder", "")
      expect(store.getTransientLoadMorePage("/folder", "")).toBe(4)
      dispose()
    })
  })

  it("ignores workspace snapshots from the previous storage key", () => {
    sessionStorageMock.setItem(
      "file-sessions-lite-v1",
      JSON.stringify([
        {
          id: "session-legacy",
          pathname: "/legacy",
          search: "?pwd=secret&view=list",
          password: "secret",
          layoutRecord: {},
        },
      ]),
    )
    sessionStorageMock.setItem("file-sessions-lite-active-v1", "session-legacy")

    createRoot((dispose) => {
      const store = createObjSessionStore({ clearSelection: vi.fn() })

      expect(store.activeFileSessionId()).toBe("")
      expect(store.password()).toBe("")
      expect(store.activeFileSessionRoute()).toBeUndefined()
      dispose()
    })
  })
})
