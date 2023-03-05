# ViBot

## Requirements
* [Node.js v19+](https://nodejs.org/en/)
* [MySQL WorkBench](https://www.mysql.com/products/workbench/)
## Optional
* Node Version Manager [Windows](https://github.com/coreybutler/nvm-windows) [Mac/Linux](https://github.com/nvm-sh/nvm)
* [Github Desktop](https://desktop.github.com/)
* [Visual Studio Code](https://code.visualstudio.com/)

## Installing
Copy `settings_template.json`, rename to `settings.json` and fill in missing info

Change the `prefix` inside of `settings.json`

Run `npm install` to install all node dependencies

Start the bot by either `node .` or via nodemon: `npm i -g nodemon` and `nodemon .` (nodemon will hot reload on file changes)