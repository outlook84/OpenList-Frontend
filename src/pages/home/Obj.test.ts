import { createRoot, createSignal } from "solid-js"
import { createComponent } from "solid-js/web"
import { beforeEach, describe, expect, it, vi } from "vitest"

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

const state = vi.hoisted(() => ({
  activeSessionId: undefined as unknown as () => string,
  setActiveSessionId: undefined as unknown as (value: string) => string,
  activeSessionRoute: undefined as unknown as () => {
    pathname: string
    search: string
  },
  setActiveSessionRoute: undefined as unknown as (value: {
    pathname: string
    search: string
  }) => { pathname: string; search: string },
  pathname: undefined as unknown as () => string,
  setPathname: undefined as unknown as (value: string) => string,
  search: undefined as unknown as () => string,
  setSearch: undefined as unknown as (value: string) => string,
  password: undefined as unknown as () => string,
  setPasswordValue: undefined as unknown as (value: string) => string,
}))

const mocks = vi.hoisted(() => ({
  handlePathChange: vi.fn(async () => undefined),
  refresh: vi.fn(),
  setPassword: vi.fn((value: string) => state.setPasswordValue(value)),
  on: vi.fn(),
  off: vi.fn(),
}))

vi.mock("@hope-ui/solid", () => {
  const passthrough = (props: { children?: unknown }) => props.children
  return {
    Text: passthrough,
    VStack: passthrough,
    Button: passthrough,
    useColorModeValue: (light: string) => () => light,
  }
})

vi.mock("~/components", () => ({
  Error: () => null,
  FullLoading: () => null,
  LinkWithBase: () => null,
}))

vi.mock("~/hooks", () => ({
  getCurrentWorkspacePage: vi.fn(() => 1),
  useObjTitle: vi.fn(),
  usePath: () => ({
    handlePathChange: mocks.handlePathChange,
    refresh: mocks.refresh,
  }),
  useRouter: () => ({
    pathname: state.pathname,
    search: state.search,
    isShare: () => true,
    to: vi.fn(),
  }),
  useT: () => (key: string) => key,
}))

vi.mock("~/store", () => ({
  activeFileSessionId: state.activeSessionId,
  activeFileSessionRoute: state.activeSessionRoute,
  objStore: {
    err: "",
    state: 0,
  },
  password: state.password,
  setPassword: mocks.setPassword,
  State: {
    Initial: 0,
    FetchingObj: 1,
    FetchingObjs: 2,
    FetchingMore: 3,
    Folder: 4,
    File: 5,
    NeedPassword: 6,
  },
  me: () => ({}),
}))

vi.mock("~/store/history", () => ({
  clearHistoryForSession: vi.fn(),
  recordHistory: vi.fn(),
}))

vi.mock("~/types", () => ({
  UserMethods: {
    is_admin: vi.fn(() => false),
  },
}))

vi.mock("~/utils", () => ({
  bus: {
    on: mocks.on,
    off: mocks.off,
  },
}))

describe("Obj password sync", () => {
  beforeEach(() => {
    ;[state.activeSessionId, state.setActiveSessionId] =
      createSignal("session-a")
    ;[state.activeSessionRoute, state.setActiveSessionRoute] = createSignal({
      pathname: "/share/demo",
      search: "?view=list",
    })
    ;[state.pathname, state.setPathname] = createSignal("/share/demo")
    ;[state.search, state.setSearch] = createSignal("?pwd=alpha&view=list")
    ;[state.password, state.setPasswordValue] = createSignal("alpha")
    mocks.handlePathChange.mockClear()
    mocks.refresh.mockClear()
    mocks.setPassword.mockClear()
    mocks.on.mockClear()
    mocks.off.mockClear()
    vi.stubGlobal("window", {})
    vi.stubGlobal("localStorage", createStorage())
    vi.stubGlobal("location", { pathname: "/share/demo" })
  })

  it("does not apply the stale URL password when switching to another workspace on the same route", async () => {
    const { Obj } = await import("./Obj")

    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        createComponent(Obj, {})

        queueMicrotask(() => {
          state.setPasswordValue("beta")
          state.setActiveSessionId("session-b")
          state.setActiveSessionRoute({
            pathname: "/share/demo",
            search: "?view=list",
          })

          queueMicrotask(() => {
            expect(mocks.setPassword).not.toHaveBeenCalledWith("alpha")
            expect(state.password()).toBe("beta")
            dispose()
            resolve()
          })
        })
      })
    })
  })
})
