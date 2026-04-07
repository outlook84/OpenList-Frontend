import { Text, useColorModeValue, VStack, Button } from "@hope-ui/solid"
import {
  createEffect,
  createMemo,
  createSignal,
  lazy,
  onCleanup,
  on,
  untrack,
  Show,
  Suspense,
  Switch,
  Match,
} from "solid-js"
import { Error, FullLoading, LinkWithBase } from "~/components"
import { isActiveSessionRouteAligned } from "./obj-route-guard"
import {
  getCurrentWorkspacePage,
  useObjTitle,
  usePath,
  useRouter,
  useT,
} from "~/hooks"
import { clearHistoryForSession, recordHistory } from "~/store/history"
import {
  getUrlPassword,
  sanitizeWorkspaceSearch,
} from "~/store/workspace-route"
import {
  activeFileSessionId,
  activeFileSessionRoute,
  objStore,
  password,
  setPassword,
  /*layout,*/ State,
  me,
} from "~/store"
import { UserMethods } from "~/types"
import { bus } from "~/utils"

const Folder = lazy(() => import("./folder/Folder"))
const File = lazy(() => import("./file/File"))
const Password = lazy(() => import("./Password"))
// const ListSkeleton = lazy(() => import("./Folder/ListSkeleton"));
// const GridSkeleton = lazy(() => import("./Folder/GridSkeleton"));

const [objBoxRef, setObjBoxRef] = createSignal<HTMLDivElement>()
export { objBoxRef }

export const Obj = () => {
  const t = useT()
  const cardBg = useColorModeValue("white", "$neutral3")
  const { pathname, search, isShare, to } = useRouter()
  const { handlePathChange, refresh } = usePath()
  useObjTitle()
  let lastSessionId = ""
  let lastPathname = ""
  let lastSearch = ""
  let lastRouteSearch = ""

  const resetLastRecordedSession = () => {
    lastSessionId = ""
    lastPathname = ""
    lastSearch = ""
    lastRouteSearch = ""
  }

  const handleFileSessionClosed = (sessionId: string) => {
    if (sessionId === lastSessionId) {
      resetLastRecordedSession()
    }
  }

  bus.on("file_session_closed", handleFileSessionClosed)
  onCleanup(() => {
    bus.off("file_session_closed", handleFileSessionClosed)
  })

  createEffect(
    on(
      [activeFileSessionId, activeFileSessionRoute, pathname, search],
      async ([sessionId, sessionRoute, nextPathname, nextSearch]) => {
        if (!sessionId) {
          return
        }

        const nextRouteSearch = sanitizeWorkspaceSearch(nextSearch)

        if (
          !isActiveSessionRouteAligned(sessionRoute, nextPathname, nextSearch)
        ) {
          return
        }

        const nextPage = getCurrentWorkspacePage(nextPathname, nextSearch)
        const didSwitchSession = !!lastSessionId && lastSessionId !== sessionId
        const didChangeVisibleRoute =
          lastPathname !== nextPathname || lastSearch !== nextSearch
        const urlPassword = getUrlPassword(nextSearch)
        const didSyncPasswordFromUrl =
          !!urlPassword &&
          (!lastSessionId || (!didSwitchSession && didChangeVisibleRoute)) &&
          urlPassword !== untrack(password)

        if (didSyncPasswordFromUrl) {
          setPassword(urlPassword)
        }

        if (
          !didSyncPasswordFromUrl &&
          !didSwitchSession &&
          lastSessionId === sessionId &&
          lastPathname === nextPathname &&
          lastRouteSearch === nextRouteSearch
        ) {
          lastSearch = nextSearch
          return
        }

        if (lastSessionId && lastPathname) {
          if (didSwitchSession) {
            clearHistoryForSession(lastSessionId)
          } else if (
            lastPathname !== nextPathname ||
            lastRouteSearch !== nextRouteSearch
          ) {
            const previousPage = getCurrentWorkspacePage(
              lastPathname,
              lastSearch,
            )
            recordHistory({
              sessionId: lastSessionId,
              pathname: lastPathname,
              search: lastSearch,
              page: previousPage,
            })
          }
        }

        lastSessionId = sessionId
        lastPathname = nextPathname
        lastSearch = nextSearch
        lastRouteSearch = nextRouteSearch

        await handlePathChange(nextPathname, nextPage)
      },
    ),
  )

  const isStorageError = createMemo(() => {
    const err = objStore.err
    return (
      err.includes("storage not found") || err.includes("please add a storage")
    )
  })

  const shouldShowStorageButton = createMemo(() => {
    return isStorageError() && UserMethods.is_admin(me())
  })

  const storageErrorActions = () => (
    <Button onClick={() => to("/@manage/storages")}>
      {t("global.go_to_storages")}
    </Button>
  )
  return (
    <VStack
      ref={(el: HTMLDivElement) => setObjBoxRef(el)}
      class="obj-box"
      w="$full"
      rounded="$xl"
      bgColor={cardBg()}
      p="$2"
      shadow="$lg"
      spacing="$2"
    >
      <Suspense fallback={<FullLoading />}>
        <Switch>
          <Match when={objStore.err}>
            <Error
              msg={objStore.err}
              disableColor
              actions={
                shouldShowStorageButton() ? storageErrorActions() : undefined
              }
            />
          </Match>
          <Match
            when={[State.FetchingObj, State.FetchingObjs].includes(
              objStore.state,
            )}
          >
            <FullLoading />
            {/* <Show when={layout() === "list"} fallback={<GridSkeleton />}>
              <ListSkeleton />
            </Show> */}
          </Match>
          <Match when={objStore.state === State.NeedPassword}>
            <Password
              title={
                isShare()
                  ? t("shares.input_password")
                  : t("home.input_password")
              }
              password={password}
              setPassword={setPassword}
              enterCallback={() => refresh(true)}
            >
              <Show when={!isShare()}>
                <Text>{t("global.have_account")}</Text>
                <Text
                  color="$info9"
                  as={LinkWithBase}
                  href={`/@login?redirect=${encodeURIComponent(
                    location.pathname,
                  )}`}
                >
                  {t("global.go_login")}
                </Text>
              </Show>
            </Password>
          </Match>
          <Match
            when={[State.Folder, State.FetchingMore].includes(objStore.state)}
          >
            <Folder />
          </Match>
          <Match when={objStore.state === State.File}>
            <File />
          </Match>
        </Switch>
      </Suspense>
    </VStack>
  )
}
