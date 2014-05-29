// This is the bot I (and Heinki) use in my Twitch chat.

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
}).loadMods('mods').addCommands(
	'say', function(o) {this.say(o.rest)},
	{
		command: 'toll',
		result: 'Toll toll super toll!',
		free: true
	},

	// info
	{
		command: 'pb',
		free: true,
		result: "Labbekak's PB is " + config.pbTime + ": " + config.pbLink
	},
	{
		command: 'wr',
		free: true,
	 	result: config.wrHolder + "'s WR is " + config.wrTime + ": " + config.wrLink
	},
	{
		command: ['lb', 'leaderboards'], 
		free: true,
		result: "The leaderboards are at " + config.leaderboards
	},

	// quotes
	{
		command: 'quote',
		free: true,
		result: function() {return randomQuoteAny()}
	},
	{
		command: 'dxquote',
		free: true,
		result: function() {return randomQuote(quotes.dx)}
	},
	{
		command: 'iwquote',
		free: true,
		result: function() {return randomQuote(quotes.iw)}
	},
	{
		command: 'hrquote',
		free: true,
		result: function() {return randomQuote(quotes.hr)}
	},
	
	// random
	{
		command: 'ask',
		free: true,
		result: function() {return pick(['Yes', 'No'])}
	},

	// polls
	'startpoll', function(o) {
		var name = o.args[0];
		config.polls = config.polls || {};
		config.polls[name] = {};
		config.curpoll = name;
		return 'Started poll ' + name + '. Everybody can vote with !vote';
	},
	'stoppoll', function(o) {
		var name = o.args[0];
		config.curpoll = null;
		return 'Stopped poll ' + name + '.';
	},
	'showpoll', function(o) {
		var name = o.args[0], t = config.polls[name];
		var x = {};
		for(var k in t) {
			var v = t[k];
			if(typeof x[v] != 'number') x[v] = 0;
			x[v] += 1;
		}
		var a = Object.keys(x).map(function(k) {return [k, x[k]]}).sort(function(a, b) {return b[1] - a[1]}).slice(0, 3);
		return a.map(function(x, i) {return (i+1) + ': ' + x[0] + ' - ' + x[1]}).join(', ');
	},
	{
		command: 'vote',
		free: true,
		result: function(o) {
			config.polls[config.curpoll][o.from] = o.rest.toLowerCase();
		}
	},

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
	'do', function(o) {
		var s;
		try {
			s = eval('(function(){'+o.rest+'})').call(this);
		} catch(e) {
			return 'Error occured: ' + e;
		}
		return s;
	}
).addVars(
	['user', 'randuser'], function() {return pick(this.users())}
).onJoin(function(nick) {
	this.say('Hey ' + nick + '!');
}).onLeave(function(nick) {
	this.say('Bye ' + nick + '!');
}).run();

var COINNAME = 'labbecoin(s)';
var STARTINGAMOUNT = 100;
var LIMIT = 60000; // in milliseconds
var EMOTICONS = ['Kappa', 'Keepo', 'FrankerZ', 'BibleThump', 'FailFish'];
var WIN_MULTIPLIER = 2;

var limits = {};
var players = twitchbot.loadJSON('slots.json');
var randNum = function() {return 0|Math.random()*EMOTICONS.length};
var numToEmoticon = function(n) {return EMOTICONS[n]};
var saveSlots = function() {twitchbot.saveJSON('slots.json', players)};

bot.addCommand({
	free: true,
	command: 'slots',
	result: function(o) {
		var player = o.from;
		var amount = +o.args[0];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0)
			return player + ': Use the command like: !slots [amount to gamble]';

		if(!limits[player]) limits[player] = 0;
		var time = limits[player];
		var now = Date.now();
		if(now - time < LIMIT)
			return player + ': You have to wait ' + (0|(LIMIT - (now - time))/1000) + ' more seconds before you can play again.';
		limits[player] = now;

		if(typeof players[player] == 'undefined') players[player] = STARTINGAMOUNT;
		var playerAmount = players[player];
		if(playerAmount <= 0 || playerAmount < amount) return player + ": You don't have enough " + COINNAME + ".";
		
		players[player] -= amount;
		
		var r = [1, 2, 3].map(randNum);
		var e = r.map(numToEmoticon).join(' ');
		var s;
		
		if(r[0] == r[1] && r[1] == r[2]) {
			players[player] += amount * WIN_MULTIPLIER;
			s = player + ": " + e + ", you won " + (amount * WIN_MULTIPLIER) + " " + COINNAME + "!";
		} else
			s = player + ": " + e + ", you lost " + amount + " " + COINNAME + "!";
		
		saveSlots();
		return s;
	}
});

bot.addCommand({
	free: true,
	command: 'give',
	result: function(o) {
		var player = o.from;
		var to = o.args[0].toLowerCase();
		var amount = +o.args[1];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0 || player == to)
			return player + ': Use the command like: !give [user] [amount]';

		if(typeof players[player] == 'undefined') players[player] = STARTINGAMOUNT;
		var playerAmount = players[player];
		if(playerAmount < amount) return player + ": You don't have enough " + COINNAME + ".";
		
		if(typeof players[to] == 'undefined') players[to] = STARTINGAMOUNT;

		players[player] -= amount;
		players[to] += amount;

		saveSlots();

		return player + ": You gave " + amount + " " + COINNAME + " to " + to + "!";
	}
});

bot.addCommand({
	free: true,
	command: 'coins',
	result: function(o) {
		var player = o.from;
		
		if(typeof players[player] == 'undefined') players[player] = STARTINGAMOUNT;

		return player + ": You have " + (players[player]) + " " + COINNAME + ".";
	}
});

bot.addCommand(
	'add',
	function(o) {
		var player = o.from;
		var to = o.args[0].toLowerCase();
		var amount = +o.args[1];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0)
			return player + ': Use the command like: !give [user] [amount]';
		
		if(typeof players[to] == 'undefined') players[to] = STARTINGAMOUNT;

		players[to] += amount;

		saveSlots();

		return player + ": You added " + amount + " " + COINNAME + " to " + to + "!";
	}
);
