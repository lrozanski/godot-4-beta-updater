type WindowsParams = {
    filePath: string
    outputPath?: string
    name?: string
    icon?: string
}

declare module "create-desktop-shortcuts" {
    export default function createDesktopShortcut(params: {windows: WindowsParams}): boolean
}
