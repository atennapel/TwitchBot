// import the library
var twitchbot = require('./twitchbot');

// create the bot
var bot = new twitchbot.TwitchBot({
	name: 'Basicbot',
	channel: 'mychannel',
	password: '[the twitch irc password from the Basicbot account]'
});

// add some commands
//
// the @ in front of a command indicates that
// this command can be run by everyone, not just mods
bot.addCommands(
	'@mycommand', 'This gets returned when mycommand is called!',
	'modcommand', 'Only mods can use this command.'
);

// start the bot
bot.run();
