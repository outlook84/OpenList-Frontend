import {
  Box,
  HStack,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Text,
} from "@hope-ui/solid"
import { changeColor } from "seemly"
import { Component, For, batch } from "solid-js"
import { AiOutlineClose } from "solid-icons/ai"
import { FaSolidLayerGroup } from "solid-icons/fa"
import { IoDuplicateOutline } from "solid-icons/io"
import { useRouter } from "~/hooks"
import {
  activeFileSessionId,
  closeFileSessionWithRoute,
  createAndOpenFileSession,
  fileSessionSummaries,
  getMainColor,
  openFileSession,
} from "~/store"
import type { FileSessionSummary } from "~/store"
import {
  getUrlPassword,
  isSameWorkspaceRoute,
  sanitizeWorkspaceSearchWithIgnoredParams,
} from "~/store/workspace-route"

const getSessionPathPreview = (pathname: string) => {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length === 0) return "Home"
  if (parts.length <= 3) return `/${parts.join("/")}`
  return `/${parts[0]}/.../${parts[parts.length - 1]}`
}

const WorkspaceMenuItem: Component<{
  session: FileSessionSummary
  active: boolean
  openSession: (sessionId: string) => void
  removeSession: (sessionId: string) => void
}> = (props) => {
  return (
    <MenuItem
      id={`workspace-session-${props.session.id}`}
      data-session-id={props.session.id}
      onSelect={() => props.openSession(props.session.id)}
      bgColor={props.active ? "$accent3" : undefined}
      rounded="$lg"
      py="$2"
      px="$2"
      mb="$1"
      _hover={{ bg: props.active ? "$accent4" : "$neutral4" }}
      _dark={{
        _hover: { bg: props.active ? "$accent5" : "$neutral3" },
      }}
    >
      <HStack w="$full" justifyContent="space-between" spacing="$2">
        <Text
          fontSize="$md"
          fontWeight="$medium"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          lineHeight="1.35"
          maxW="calc(100% - 2rem)"
        >
          {getSessionPathPreview(props.session.pathname)}
        </Text>
        <IconButton
          aria-label="Close workspace"
          icon={
            <AiOutlineClose
              size="1.05em"
              style={{
                display: "block",
              }}
            />
          }
          {...({ variant: "ghost" } as any)}
          size="sm"
          compact
          color={getMainColor()}
          opacity={0.8}
          w="$8"
          minW="$8"
          h="$8"
          p="0"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          _hover={
            {
              opacity: 1,
              bg: changeColor(getMainColor(), { alpha: 0.15 }),
            } as any
          }
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            props.removeSession(props.session.id)
          }}
        />
      </HStack>
    </MenuItem>
  )
}

export const Workspaces = () => {
  const { pathname, search, to } = useRouter()

  const deferWorkspaceAction = (action: () => void) => {
    window.requestAnimationFrame(() => {
      action()
    })
  }

  const syncUrlForSessionRoute = (nextPathname: string, nextSearch: string) => {
    if (!isSameWorkspaceRoute(pathname(), search(), nextPathname, nextSearch)) {
      to(`${nextPathname}${nextSearch}`, false, {
        clearHistory: false,
      })
      return
    }

    if (!getUrlPassword(search())) {
      return
    }

    to(
      `${nextPathname}${sanitizeWorkspaceSearchWithIgnoredParams(search(), ["pwd"])}`,
      false,
      {
        clearHistory: false,
        replace: true,
      },
    )
  }

  const openSession = (sessionId: string) => {
    const session = fileSessionSummaries().find((item) => item.id === sessionId)
    if (!session) return
    deferWorkspaceAction(() => {
      batch(() => {
        openFileSession(sessionId)
        syncUrlForSessionRoute(session.pathname, session.search)
      })
    })
  }

  const addSession = () => {
    createAndOpenFileSession(pathname(), search())
  }

  const removeSession = (sessionId: string) => {
    deferWorkspaceAction(() => {
      batch(() => {
        const { didCloseActiveSession, nextSession } =
          closeFileSessionWithRoute(sessionId)
        if (didCloseActiveSession && nextSession) {
          syncUrlForSessionRoute(nextSession.pathname, nextSession.search)
        }
      })
    })
  }

  return (
    <Menu placement="bottom-end">
      <MenuTrigger
        as={IconButton}
        aria-label="Workspaces"
        icon={<FaSolidLayerGroup size="1em" />}
        compact
        size="lg"
        color={getMainColor()}
        bgColor={changeColor(getMainColor(), { alpha: 0.15 })}
        _hover={
          {
            bg: changeColor(getMainColor(), { alpha: 0.2 }),
          } as any
        }
      />
      <MenuContent
        minW="$72"
        maxW="min(28rem, calc(100vw - 2rem))"
        p="$1"
        bgColor="white"
        _dark={{ bg: "$neutral2" } as any}
        border="1px solid $neutral6"
        rounded="$xl"
        shadow="$xl"
      >
        <Box py="$1" px="$2" mb="$1">
          <HStack
            w="$full"
            justifyContent="flex-end"
            minH="$6"
            alignItems="center"
          >
            <IconButton
              aria-label="Add workspace"
              icon={
                <IoDuplicateOutline
                  size="1.25em"
                  style={{
                    display: "block",
                  }}
                />
              }
              {...({ variant: "ghost" } as any)}
              size="sm"
              compact
              color={getMainColor()}
              opacity={0.9}
              w="$8"
              minW="$8"
              h="$8"
              p="0"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              style={{
                transform: "translateX(-3px)",
              }}
              _hover={
                {
                  opacity: 1,
                  bg: changeColor(getMainColor(), { alpha: 0.15 }),
                } as any
              }
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                addSession()
              }}
            />
          </HStack>
        </Box>
        <For each={fileSessionSummaries()}>
          {(session) => {
            return (
              <WorkspaceMenuItem
                session={session}
                active={session.id === activeFileSessionId()}
                openSession={openSession}
                removeSession={removeSession}
              />
            )
          }}
        </For>
      </MenuContent>
    </Menu>
  )
}
