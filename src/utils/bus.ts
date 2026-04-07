import mitt from "mitt"

type Events = {
  to: string
  gallery: string
  tool: string
  extract: string
  file_session_closed: string
  file_session_password_changed: string
  file_session_cloned: {
    sourceSessionId: string
    sessionId: string
  }
}

export const bus = mitt<Events>()
