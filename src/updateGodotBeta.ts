// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="global/index.d.ts" />
//
import AdmZip from "adm-zip"
import axios from "axios"
import chalk from "chalk"
import cliProgress from "cli-progress"
import {program} from "commander"
import createDesktopShortcut from "create-desktop-shortcuts"
import {textSync} from "figlet"
import {existsSync, linkSync, mkdirSync, rmSync} from "fs"
import {round} from "lodash"
import parse, {HTMLElement} from "node-html-parser"
import Downloader from "nodejs-file-downloader"
import {homedir} from "os"
import {join, resolve} from "path"
import {exit} from "process"

if (process.platform !== "win32") {
    console.log(chalk.redBright("This CLI only supports Windows. Exiting"))
    exit(1)
}
const godot4MonoBetaLabel = chalk.greenBright("Godot 4 Beta .NET")

console.log(chalk.bold(chalk.greenBright(textSync("Godot Updater"))))
console.log()

program
    .version("1.0.0")
    .description("A CLI tool meant to automatically update Godot 4 beta .NET versions")
    .requiredOption("-t, --target-folder <path>", "Path to the directory which will store all Godot versions")
    .parse(process.argv)

const options = program.opts<{targetFolder: string}>()
const targetFolder = options.targetFolder.replace(/\\+/g, "/")
!existsSync(targetFolder) && mkdirSync(targetFolder)

const compareLinks = (link1: HTMLElement, link2: HTMLElement) =>
    link1.textContent.localeCompare(link2.textContent, undefined, {
        numeric: true,
        sensitivity: "base",
    })

async function findLatestBeta() {
    const response = await axios.get("https://downloads.tuxfamily.org/godotengine/4.0/")
    const root = parse(response.data as string)
    const links = root.querySelectorAll("a")
    const latestBeta = links
        .sort(compareLinks)
        .filter(link => link.textContent.includes("beta"))
        .slice(-1)

    return latestBeta[0].getAttribute("href")?.replace("/", "")
}

async function resolveLatestBetaPath() {
    const latestBetaFolder = await findLatestBeta()
    const filename = `Godot_v4.0-${latestBetaFolder}_mono_win64.zip`
    const path = `https://downloads.tuxfamily.org/godotengine/4.0/${latestBetaFolder}/mono/${filename}`

    console.log(`Latest ${godot4MonoBetaLabel}: ${chalk.blueBright(path)}`)

    return {
        filename,
        path,
        betaName: latestBetaFolder,
    }
}

async function downloadLatestBeta(filename: string, path: string, downloadDirectory: string) {
    let totalLength = 0
    const progressBar = new cliProgress.SingleBar(
        {
            format: "Downloading |" + chalk.cyan("{bar}") + "| {percentage}% || {value}/{total} MB",
            barCompleteChar: "\u2588",
            barIncompleteChar: "\u2591",
            hideCursor: true,
            formatValue: (value, options, type) => {
                switch (type) {
                    case "value":
                    case "total":
                        return `${round(value / 1024 / 1024, 2)}`
                    default:
                        return `${value}`
                }
            },
        },
        cliProgress.Presets.shades_grey
    )

    console.log(`Downloading ${godot4MonoBetaLabel} to ${chalk.yellowBright(join(targetFolder, filename))}`)
    const downloader = new Downloader({
        url: path,
        directory: downloadDirectory,
        onResponse: response => {
            totalLength = +response.headers["content-length"]!
            progressBar.start(totalLength, 0)
        },
        onProgress: (percentage, chunk, remainingSize) => {
            progressBar.update(totalLength - remainingSize)
            progressBar.render()
        },
    })
    const {filePath} = await downloader.download()

    progressBar.stop()
    return filePath
}

const isExtracted = (downloadPath: string) => existsSync(downloadPath.replace(".zip", ""))

resolveLatestBetaPath().then(async ({filename, path, betaName}) => {
    const downloadDirectory = targetFolder
    const downloadPath = join(downloadDirectory, filename)

    if (!existsSync(downloadPath) && !isExtracted(downloadPath)) {
        await downloadLatestBeta(filename, path, downloadDirectory)
    } else {
        console.log(chalk.yellowBright("Latest version already downloaded. Skipping download"))
    }
    if (isExtracted(downloadPath)) {
        console.log(chalk.yellowBright("Archive already extracted. Skipping"))
    } else {
        console.log(`Extracting archive to ${chalk.blueBright(downloadDirectory)}`)
        try {
            new AdmZip(downloadPath).extractAllTo(downloadDirectory)
        } catch (e) {
            console.error(chalk.red("Failed to extract archive. Exiting"))
            exit(1)
        }
        console.log(chalk.greenBright("Archive extracted successfully"))
    }
    const executableFilename = `Godot_v4.0-${betaName}_mono_win64.exe`
    const executablePath = resolve(join(downloadPath.replace(".zip", ""), executableFilename))

    try {
        const latestDir = join(targetFolder, "latest")
        !existsSync(latestDir) && mkdirSync(latestDir)
        const hardLinkTarget = executablePath
        const hardLinkPath = join(latestDir, "Godot_v4.0-beta_mono_win64.exe")

        if (existsSync(hardLinkPath)) {
            console.log(chalk.yellowBright("Symlink already exists. Replacing"))
            rmSync(hardLinkPath)
        } else {
            console.log(
                `Creating hard link to ${chalk.blueBright(hardLinkTarget)} at ${chalk.blueBright(hardLinkPath)}`
            )
            linkSync(hardLinkTarget, hardLinkPath)
            console.log(chalk.greenBright("Hard link created successfully"))
        }
    } catch (e) {
        console.error(chalk.red(`Creating hard link failed with message: ${e}. Exiting`))
        exit(1)
    }
    const startMenuPath = join(
        homedir(),
        "AppData",
        "Roaming",
        "Microsoft",
        "Windows",
        "Start Menu",
        "Programs",
        "Godot 4 Beta"
    )
    !existsSync(startMenuPath) && mkdirSync(startMenuPath)

    const shortcutCreated = createDesktopShortcut({
        windows: {
            filePath: executablePath,
            outputPath: startMenuPath,
            name: "Godot 4 Mono Beta",
            icon: executablePath,
        },
    })
    if (shortcutCreated) {
        console.log(chalk.greenBright("Start Menu shortcut created successfully"))
    } else {
        console.error(chalk.red("Creating Start Menu shortcut failed. Exiting"))
        exit(1)
    }
    console.log(chalk.greenBright("All done. Cleaning up"))
    existsSync(downloadPath) && rmSync(downloadPath)
})
