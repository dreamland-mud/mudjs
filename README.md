# mudjs

[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://stand-with-ukraine.pp.ua)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0.html)

The browser client for DreamLand MUD. It talks to the game over a WebSocket and is played at https://dreamland.rocks/play.

The client is a React app built with Vite. The main branch is `dreamland`. It is tied to the DreamLand server protocol and all work happens there. The `master` branch is an older generic client for any MUD and is frozen.

## Run it locally

You need Node.js 20.19 or newer (the deploy uses 22) and npm.

```bash
git clone https://github.com/dreamland-mud/mudjs.git
cd mudjs
git checkout dreamland
npm install
npm run dev
```

The dev server listens on port 3000 and reloads when you save a file. Open http://localhost:3000/play/ (the root address redirects there). By default the client connects to the main game at dreamland.rocks.

To connect to the builders' server instead, open the page with `#build` at the end of the address:

```text
http://localhost:3000/play/#build
```

If the page loads but the client cannot connect, check whether an ad blocker is active on the page.

## Build

```bash
npm run build
```

The bundle goes to `build/`, with the base path `/play/`. The build also writes `build/version.json`, which the running client polls to notice a new deploy.

## More

* [Client-Web-Development](https://github.com/dreamland-mud/dreamland_code/wiki/Client-Web-Development): source layout and how to change the client
* [Client-Web-Protocol](https://github.com/dreamland-mud/dreamland_code/wiki/Client-Web-Protocol): the commands, prompt data and markup tags the server sends
* [Local-Setup](https://github.com/dreamland-mud/dreamland_code/wiki/Local-Setup): how to run the game server itself
* [Repositories](https://github.com/dreamland-mud/dreamland_code/wiki/Repositories): how mudjs fits with the other repositories

## License

GPLv3. See `LICENSE`.
