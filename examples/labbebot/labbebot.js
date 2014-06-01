var twitchbot = require('twitchbot');

var quotes = twitchbot.loadJSON('quotes.json');
var config = twitchbot.loadJSON('config.json');

// utility functions
var pick = function(a) {return a[0|Math.random()*a.length]};
var randomQuoteAny = function() {return randomQuote(pick([quotes.dx, quotes.iw, quotes.hr]))};
var randomQuote = function(q) {var name = pick(Object.keys(q)); return '"' + pick(q[name]) + '" - ' + name};
var minutes = function(n) {return n*60*1000};

// the bot
var bot = new twitchbot.TwitchBot({
	channel: config.channel,
	name: config.name,
	password: config.password,
	debug: true
});
bot.loadMods('mods');
bot.load('bot.json');
bot.addCommands(
	'say', function(o) {this.say(o.rest)},
	'@toll', 'Toll toll super toll!',
	
	// info
	'@pb', "Labbekak's PB is " + config.pbTime + ": " + config.pbLink,
	'@wr', config.wrHolder + "'s WR is " + config.wrTime + ": " + config.wrLink,
	['@lb', '@leaderboards'], "The leaderboards are at " + config.leaderboards,

	// quotes
	'@quote', function() {return randomQuoteAny()},
	'@dxquote', function() {return randomQuote(quotes.dx)},
	'@iwquote', function() {return randomQuote(quotes.iw)},
	'@hrquote', function() {return randomQuote(quotes.hr)},
	
	// random
	'@ask', function() {return pick(['Yes', 'No'])},

	// add command
	'addcommand', function(o) {
		var name = o.args[0];
		var rest = o.rest.slice(name.length+1).trim();
		this.addCommand(name, rest);
		return 'Added command ' + name + '.';
	},
	'addfreecommand', function(o) {
		var name = o.args[0];
		var rest = o.rest.slice(name.length+1).trim();
		this.addCommand({command: name, result: rest, free: true});
		return 'Added command ' + name + '.';
	},
	'removecommand', function(o) {
		var name = o.args[0];
		this.removeCommand(name);
		return 'Removed command ' + name + '.';
	},
	'do', function(o) {
		var s;
		try {
			s = eval('(function(){'+o.rest+'})').call(this);
		} catch(e) {
			return 'Error occured: ' + e;
		}
		return s;
	}
);

bot.addVars(
	['user', 'randuser'], function() {return pick(this.users())}
);

bot.onJoin(function(nick) {this.say('Hey ' + nick + '!')});
bot.onLeave(function(nick) {this.say('Bye ' + nick + '!')});
bot.setAutosave('bot.json');
bot.run();
