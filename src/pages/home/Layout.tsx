import { Markdown } from "~/components"
import { useRouter, useTitle } from "~/hooks"
import { getSetting, syncWorkspaceSession } from "~/store"
import { notify } from "~/utils"
import { Body } from "./Body"
import { Footer } from "./Footer"
import { Header } from "./header/Header"
import { Toolbar } from "./toolbar/Toolbar"
import { createEffect, onMount } from "solid-js"

let announcementShown = false

const Index = () => {
  const { pathname, search } = useRouter()
  useTitle(getSetting("site_title"))
  const announcement = getSetting("announcement")

  onMount(() => {
    if (announcement && !announcementShown) {
      notify.render((() => <Markdown children={announcement} />) as any)
      announcementShown = true
    }
  })

  createEffect(() => {
    syncWorkspaceSession(pathname(), search())
  })
  return (
    <>
      <Header />
      <Toolbar />
      <Body />
      <Footer />
    </>
  )
}

export default Index
