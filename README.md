TwitchBot
=========

A Node.JS module to help in creating Twitch bots.

# API
## TwitchBot methods

### TwitchBot(options)
Creates a TwitchBot, the following options can be used:
#### server
The server of the irc (defaults to `irc.twitch.tv`)
#### port
The port of the irc (defaults to `6667`)
#### commandChar
The character that precedes commands (defaults to `!`)
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
### addCommands(command, result, ...)
Add commands to the bot.
### addVars(name, value, ...)
Add variables to the bot (to be used in the command results).
### doMessage(text, [from, to, msg])
Send a message to the bot as if an user send a message to the channel.
