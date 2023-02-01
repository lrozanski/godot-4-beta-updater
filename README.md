# Godot 4 Beta Updater

## Instructions

Execute the below command to run the tool, at least until I get around to releasing binaries.

```bash
npm i # only needed once
npm run dev -- -t <path> [-b <version>]
```

Help:

```bash
Usage: updateGodotBeta [options]

A CLI tool meant to automatically update Godot 4 beta .NET versions

Options:
  -V, --version               output the version number
  -t, --target-folder <path>  Path to the directory which will store all Godot versions
  -b, --beta <value>          Godot 4 Beta version (e.g. 17)
  -h, --help                  display help for command
```
