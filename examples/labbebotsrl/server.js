/* Labbebot-srl
 * This is the chatbot used in #deusex at the SRL IRC.
 * @author: Albert ten Napel (Labbekak)
 */
var twitchbot = require('./twitchbot');

var quotes = twitchbot.loadJSON('quotes.json');
var userquotes = twitchbot.loadJSON('userquotes.json');
var config = twitchbot.loadJSON('config.json');

// utility functions
var pick = function(a) {return a[0|Math.random()*a.length]};
var randomQuoteAny = function() {
	if(Object.keys(userquotes).length > 0)
		return randomQuote(pick([quotes.dx, quotes.iw, quotes.hr, userquotes]));
	return randomQuote(pick([quotes.dx, quotes.iw, quotes.hr]));
};
var randomQuote = function(q) {var name = pick(Object.keys(q)); return '"' + pick(q[name]) + '" - ' + name};

// the bot
var bot = new twitchbot.TwitchBot(config);
bot.loadLibs('libs');
bot.addCommands(
	'say', function(o) {this.say(o.rest)},
	'@toll', 'Toll toll super toll!',
	
	// info
	'@wr', config.wr,
	'@dxwr', config.dxwr,
	'@iwwr', config.iwwr,
	'@hrwr', config.hrwr,
	'@hrdcwr', config.hrdcwr,
	'@tfwr', config.tfwr,
	['@lb', '@leaderboards'], config.lb,

	// quotes
	'@quote', function() {return randomQuoteAny()},
	'@dxquote', function() {return randomQuote(quotes.dx)},
	'@iwquote', function() {return randomQuote(quotes.iw)},
	'@hrquote', function() {return randomQuote(quotes.hr)},
	'@userquote', function() {
		if(Object.keys(userquotes).length > 0)
			return randomQuote(userquotes);
		return 'There are no user quotes! Add some with !addquote [name] [quote]';
	},

	'@addquote', function(o) {
		var name = o.args[0];
		var quote = o.rest.slice(name.length+1).trim();
		userquotes[name] = userquotes[name] || [];
		userquotes[name].push(quote);
		return 'Quote of ' + name + ' added!';
	},
	
	// random
	'@ask', function(o) {
		var r = pick(['Yes.', 'No.', 'Maybe.']);
		return r;
	},

	// add command
	['@commands', '@help'], function() {
		return 'The commands are: ' + this.getFreeCommands();
	},
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
	['do', 'js'], function(o) {
		var s;
		try {
			s = eval('(function(){return ""+('+o.rest+')})').call(this);
		} catch(e) {
			return 'Error occured: ' + e;
		}
		return s;
	}
);

bot.makeCommandFree('logs');
bot.makeCommandFree('searchlogs');
bot.makeCommandFree('countlogs');
bot.makeCommandFree('logssize');

bot.alwaysMod('labbekak');

bot.addVars(
	['user', 'randuser'], function() {return pick(this.users())}
);
bot.run();

// server
var http = require('http');
var server = http.createServer(function(req, res) {
	res.end((bot.logger_logs || []).join('\n'));
});
server.listen(process.env.OPENSHIFT_NODEJS_PORT || 80,
							process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1');
