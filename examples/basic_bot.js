var twitchbot = require('twitchbot');

var bot = new twitchbot.TwitchBot({
	channel: 'channel',
	name: 'basicbot',
	password: 'password'
}).run().addCommands(
	// on any input, return the input
	/^.*$/, function(from, to, text, message) {return text}
);
