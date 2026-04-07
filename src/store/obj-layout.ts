import { createSignal } from "solid-js"

type ObjLayoutControllerDeps<TLayout extends string> = {
  getPathname: () => string
  getLayoutRecord: () => Record<string, TLayout>
  setLayoutRecord: (next: Record<string, TLayout>) => void
  getDefaultLayout: () => TLayout
  clone: <T>(value: T) => T
}

export const createObjLayoutController = <TLayout extends string>(
  deps: ObjLayoutControllerDeps<TLayout>,
) => {
  const [_layout, _setLayout] = createSignal<TLayout>(
    deps.getLayoutRecord()[deps.getPathname()] || deps.getDefaultLayout(),
  )

  const layout = () => {
    const nextLayout = deps.getLayoutRecord()[deps.getPathname()]
    _setLayout(() => nextLayout || deps.getDefaultLayout())
    return _layout()
  }

  const setLayout = (layout: TLayout) => {
    const layoutRecord = deps.clone(deps.getLayoutRecord())
    layoutRecord[deps.getPathname()] = layout
    deps.setLayoutRecord(layoutRecord)
    _setLayout(() => layout)
  }

  return {
    layout,
    setLayout,
  }
}
