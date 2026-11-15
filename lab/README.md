# Jaiz Microservices Web Lab (trainer)

One browser tab with the **step-by-step trainer guide on the left** and a **real VS Code on the right**. The VS Code includes a terminal, the .NET 10 SDK and Docker, so you never have to switch between the PDF and your editor.

```
+------------------------+----------------------------------+
| Part 4 — Transfer      |  VS Code (in the browser)        |
| 4.2 Install Kafka pkg  |  EXPLORER | Program.cs           |
|                        |           |                      |
| [dotnet add ...] [Copy]|  TERMINAL                        |
| Explain / Ask the room |  $ dotnet add TransferService ...|
| ◀ Back        Next ▶   |                                  |
+------------------------+----------------------------------+
```

## Requirements
- Docker Desktop (macOS/Windows) or Docker Engine + Compose (Linux), running.
- Internet access the first time (downloads code-server, the .NET SDK and the NuGet packages).

## Start
```bash
cd lab
./start.sh
```
Then open **http://localhost:3000**. The first start builds the VS Code image, which takes a few minutes.

**Which folder VS Code opens**
| Command | VS Code opens |
|---|---|
| `./start.sh` | This repo folder (`jaiz-microservices-lab`), so you edit the real files |
| `./start.sh workspace` | `lab/workspace/`, an empty folder for building everything from scratch with the guide |
| `./start.sh /any/other/folder` | That folder |

## Stop
```bash
./stop.sh
```
Your files are kept.

## Switch folders / start fresh
```bash
./stop.sh
./start.sh workspace                              # empty folder for live-coding
rm -rf workspace/jaiz-microservices-lab        # wipe a previous from-scratch run
```

## How to use the guide
| Action | How |
|---|---|
| Next / back | **Next ▶** / **◀ Back** buttons, or the `→` / `←` keys |
| Jump to a part | Drop-down at the top |
| Copy a command or file | **Copy** button, then paste into the VS Code terminal or editor |
| Hide the guide (full-screen VS Code) | `G` key or **⇤ Guide** |
| Bigger text for the projector | **A+ / A−** |
| Resize | Drag the divider |
| VS Code in its own tab | **VS Code ↗** |

Your current step, ticks, text size and layout are remembered in this browser.

## Things to know
- **Files** you edit in the browser VS Code are the real files on this laptop, in the folder the lab was started on.
- **Docker** commands you run in the browser VS Code use this laptop's Docker Desktop. The workshop containers are the same as if you ran them from a normal terminal.
- **`lab-ports on`** is the one extra step (start of Part 10). Inside the browser VS Code, `localhost` means the VS Code container itself. This command forwards `localhost:5101/5102/8000/8001` to the laptop, so every `curl` in the guide works exactly as written. Run `lab-ports off` before repeating Part 3.3's `dotnet run` on port 5101.
- The lab listens on `127.0.0.1:3000` only and has no password. Only this laptop can open it.

## Files
| Path | Purpose |
|---|---|
| `docker-compose.yml` | Starts the lab (`ide` and `gateway`) |
| `ide/` | Browser VS Code image: code-server, .NET 10 SDK, Docker CLI, `lab-ports` |
| `nginx.conf` | Serves the guide at `/` and VS Code at `/code/` |
| `guide/steps.js` | The guide content. Edit this to change the steps. |
| `guide/app.js`, `guide/style.css`, `guide/index.html` | Guide page |

The code in the guide is identical to the reference solution in the repository root.
