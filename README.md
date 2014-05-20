TwitchBot
=========

A Node.JS module to help in creating Twitch bots.

# API
## static functions
### loadJSON(filename)
Loads a JSON file, if the file doesn't exists returns an empty object.
### saveJSON(filename, obj)
Saves an object as a JSON file.

## TwitchBot methods

### TwitchBot(options)
Creates a TwitchBot, the following options can be used:
#### server
The server of the irc (defaults to `irc.twitch.tv`)
#### port
The port of the irc (defaults to `6667`)
#### commandChar
The character that precedes commands (defaults to `!`)
#### varChar
The character to put variables in a string (defaults to `)
#### debug
If set to true, debug messages will be output to the console (defaults to `false`)
#### name (required)
The name of the bot
#### password (required)
The Twitch irc password of the bot. 
#### channel (required)
The Twitch channel to join. 

### users()
Returns all users in the channel.
### mods()
Returns all mods in the channel.
### isMod(user)
Returns if user is a mod.
### run()
Start the bot.
### say(msg)
Let the bot send a message.
### sayWithVars(msg, [vars])
Let the bot send a message and replace any vars.
### addCommands(command, result, ...)
Add commands to the bot.
### addVars(name, value, ...)
Add variables to the bot (to be used in the command results).
### getVar(var)
Get a variable.
### doMessage(text, [from, to, msg])
Send a message to the bot as if an user send a message to the channel.
### onJoin(fn)/onLeave(fn)
Add an event when an user joins/leaves, the function get the name of the user as argument.
