# ViBot

## Requirements
[Node.js v16+](https://nodejs.org/en/)

[MySQL WorkBench](https://www.mysql.com/products/workbench/)

## Installing
Copy `settings_template.json`, rename to `settings.json` and fill in missing info

Run `npm i` to install all node dependencies

Start the bot by either `node .` or via nodemon: `npm i -g nodemon` and `nodemon .` (nodemon will hot reload on file changes)

# Documentation
## Command Parameters
*All of these are case sensitive, and it is required that you type them exactly like how they are displayed below*

**Name**: (String) The name of the command. This is something the user has to input in order to run the command.
Required: true
Default: null

**description**: (String) This is a description about what the command does.
Required: true
Default: null

**alias**: (Array) These are alternative names a user can input to run the command.
Required: false
Default: null

**args**: (String) This is a short description of any arguements a user has to submit in order to run the command successfully.
Required: false
Default: null

**requiredArgs**: (Number) This is the required amount of arguements any user has to pass in order to use the command.
Required: false
Default: 0

**role**: (String) This is the minimum role required to use this command
Required: true
Default: null

**guildSpecific**: (Boolean) If set to true, any server will by default have this command disabled until turned on later
Required: false
Default: false

**roleOverride**: (Object) Allows the user to set a default role override for specific guilds
Required: false
Default: null
Example: { guildid: role }

**restarting**: (Boolean) Used for the restart command, if the bot is restarting commands will be disabled, unless the parameter below is used.
Required: false
Default: null

**allowedInRestart**: (Boolean) If this is set to true, the command will be allowed to be used even while the bot has a pending restart
Required: false
Default: false

**getNotes** (async Function) This takes in (guildid, member) allows the user to create a 'Special Notes' section under the help command that is specific to the guild
Required: false
Default: null
