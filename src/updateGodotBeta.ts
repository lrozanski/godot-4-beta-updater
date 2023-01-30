/// <reference path="global/index.d.ts" />

import axios from "axios"
import chalk from "chalk"
import { textSync } from "figlet"
import parse from "node-html-parser"
import Downloader from "nodejs-file-downloader"
import cliProgress from "cli-progress"
import { round } from "lodash"
import { existsSync, fstat, linkSync, symlinkSync } from "fs"
import { join, resolve } from "path"
import AdmZip from "adm-zip"
import { exit } from "process"
import createDesktopShortcut from "create-desktop-shortcuts"

const godot4MonoBetaLabel = chalk.greenBright("Godot 4 Beta .NET")

console.log(chalk.bold(chalk.greenBright(textSync("Godot Updater"))))
console.log()

async function findLatestBeta() {
    const response = await axios.get("https://downloads.tuxfamily.org/godotengine/4.0/")
    const root = parse(response.data as string)
    const links = root.querySelectorAll("a")
    const latestBeta = links
        .sort((link1, link2) => link1.textContent.localeCompare(link2.textContent, undefined, { numeric: true, sensitivity: "base" }))
        .filter(link => link.textContent.includes("beta"))
        .slice(-1)

    return latestBeta[0].getAttribute("href")?.replace("/", "")
}

async function resolveLatestBetaPath() {
    const latestBetaFolder = await findLatestBeta()
    const filename = `Godot_v4.0-${latestBetaFolder}_mono_win64.zip`
    const path = `https://downloads.tuxfamily.org/godotengine/4.0/${latestBetaFolder}/mono/${filename}`

    console.log(`Latest ${godot4MonoBetaLabel}: ${chalk.blueBright(path)}`);

    return {
        filename,
        path,
        betaName: latestBetaFolder
    }
}

async function downloadLatestBeta(filename: string, path: string, downloadDirectory: string) {
    let totalLength = 0
    let progressBar = new cliProgress.SingleBar({
        format: 'Downloading |' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} MB',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
        formatValue: (value, options, type) => {
            switch (type) {
                case "value":
                case "total":
                    const megaBytes = round(value / 1024 / 1024, 2)
                    return `${megaBytes}`
                default:
                    return `${value}`
            }
        }
    }, cliProgress.Presets.shades_grey)

    console.log(`Downloading ${godot4MonoBetaLabel} from ${chalk.yellowBright(path)}`)
    const downloader = new Downloader({
        url: path,
        directory: downloadDirectory,
        onResponse: (response) => {
            totalLength = +response.headers['content-length']!
            progressBar.start(totalLength, 0)
        },
        onProgress: (percentage, chunk, remainingSize) => {
            progressBar.update(totalLength - remainingSize)
            progressBar.render()
        },
    })
    const { filePath, downloadStatus } = await downloader.download()

    progressBar.stop()
    return filePath
}

resolveLatestBetaPath()
    .then(async ({ filename, path, betaName }) => {
        const downloadDirectory = "downloads/"
        const downloadPath = join(downloadDirectory, filename)

        if (!existsSync(downloadPath)) {
            await downloadLatestBeta(filename, path, downloadDirectory)
        } else if (existsSync(downloadPath) || existsSync(downloadPath.replace(".zip", ""))) {
            console.log(chalk.yellowBright(`Latest version already downloaded. Skipping download`))
        }
        if (existsSync(downloadPath.replace(".zip", ""))) {
            console.log(chalk.yellowBright("Archive already extracted. Skipping"));
        } else {
            console.log(`Extracting archive to ${chalk.blueBright(downloadDirectory)}`);
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
            const hardLinkTarget = executablePath
            const hardLinkPath = join(`C:\\Users\\lroza\\godot\\latest\\Godot_v4.0-beta_mono_win64.exe`)

            if (existsSync(hardLinkPath)) {
                console.log(chalk.yellowBright("Symlink already exists. Skipping"))
            } else {
                console.log(`Creating hard link to ${chalk.blueBright(hardLinkTarget)} at ${chalk.blueBright(hardLinkPath)}`)
                linkSync(hardLinkTarget, hardLinkPath)
                console.log(chalk.greenBright("Hard link created successfully"))
            }
        } catch (e) {
            console.error(chalk.red(`Creating hard link failed with message: ${e}. Exiting`))
            exit(1)
        }
        const shortcutCreated = createDesktopShortcut({
            windows: {
                filePath: executablePath,
                outputPath: "C:\\Users\\lroza\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\",
                name: "Godot 4 Mono Beta",
                icon: executablePath
            }
        })
        if (shortcutCreated) {
            console.log(chalk.greenBright("Start Menu shortcut created successfully"))
        } else {
            console.error(chalk.red("Creating Start Menu shortcut failed. Exiting"))
            exit(1)
        }
    })
