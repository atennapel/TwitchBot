/* Quotes plugin for TwitchBot
 * @author: Albert ten Napel
 * @version: 0.3
 *
 * Adds a quotes system so that users can get random quotes and so that people can add quotes.
 * The quotes are divided in groups (such as quotes from movies, or specific games) and the
 * groups are divided in persons (or things) from which the quotes are.
 *
 * 	Options: {
 *		saveToFile: whether to save and load the player data to file,
 *		file: the file to use,
 *		saveInInterval: whether to save every so often,
 *		saveTime: if saveInInterval is true, how often to save in milliseconds,
 *		free: all users can use the addquote and addquoteto command,
 *		format: the format how to show quotes, the variables that can be used are:
 *			$group, $person, $quote
 *		default: the default group to add quotes to (defaults to "default")
 *		aliases: object that provides alias commands for specific groups 
 *	}
 *	
 *	Free commands:
 *		quote [group]: show a random quote from [group] ([group] can be left out to show a quote from a random group)
 *
 *	Mod commands:
 *		addquote [person]: [quote]: add a quote to the default group, after [person] there must be a colon.
 *		addquoteto [group] [person]: [quote]: like addquote but specifies a group (group cannot contain whitespace)
 */
function(bot, twitchbot) {
	var config = bot.config.quotes || {};
	var FILE = config.file || 'quotes.json';
	var SAVE_TO_FILE = config.saveToFile || false;
	var SAVE_IN_INTERVAL = config.saveInInterval || false;
	var SAVE_TIME = config.saveTime || 60*1000;
	var FREE = config.free || false;
	var FORMAT = config.format || '"$quote" - $person';
	var DEFAULT = config.default || 'default';
	var ALIAS = config.aliases || {};

	var quotes = {};
	if(SAVE_TO_FILE) {
		var file = new twitchbot.JSONFile(FILE);
		file.onExitSave(bot);
		if(SAVE_IN_INTERVAL) file.saveEvery(SAVE_TIME);
		quotes = file.load().get();
	}

	function cmd(x) {return (FREE? '@': '') + x};

	function match(a, b) {
		return a == b || a.toLowerCase() == b.toLowerCase() ||
			(new RegExp(a.split(/\s+/g).join('|'), 'gi')).test(b) ||
			(new RegExp(b.split(/\s+/g).join('|'), 'gi')).test(a);
	};

	function findMatch(s, a) {
		for(var i = 0, l = a.length; i < l; i++)
			if(match(s, a[i]))
				return a[i];
		return false;
	};

	var keys = Object.keys;

	function pick(a) {
		return a[Array.isArray(a)? 0|a.length*Math.random(): pick(keys(a))];
	};

	function pickk(o) {return pick(keys(o))};

	function format(group, person, quote) {
		var vars = {group: group, person: person, quote: quote};
		return FORMAT.replace(/\$[a-z]+/gi,
			function(x) {return vars[x.slice(1)] || ''});
	}

	function size(o) {return keys(o).length};

	function getQuote(group, person, i) {
		var group = group || pickk(quotes);
		var person = person || pickk(quotes[group]);
		var quote = typeof i == 'number'?
			quotes[group][person][i]:
			pick(quotes[group][person]);
		return format(group, person, quote);
	};

	bot.addCommand('@quote', function(o) {
		if(o.rest.trim().length == 0) return getQuote();
		var group = o.rest.trim();
		var m = findMatch(group, keys(quotes));
		if(m) return getQuote(m);
		return 'Cannot find a quote group called ' + group;
	});

	bot.addCommand('@quotefrom', function(o) {
		var name = o.rest.trim();
		for(var k in quotes)
			for(var nameq in quotes[k])
				if(match(name, nameq))
					return getQuote(k, nameq);
		return 'Cannot find a quote group called ' + group;
	});

	bot.addCommand(cmd('addquote'), function(o) {
		var group = DEFAULT;
		var s = o.rest.split(':');
		var name = '', quote = '';
		if(s.length == 1) {
			quote = s[0].trim();
		} else {
			name = s[0].trim();
			quote = s.slice(1).join(':').trim();
		}
		quotes[group] = quotes[group] || {};
		quotes[group][name] = quotes[group][name] || [];
		quotes[group][name].push(quote);
		return 'Quote of ' + name + ' added!';
	});

	bot.addCommand(cmd('addquoteto'), function(o) {
		var group = o.args[0];
		var s = o.rest.slice(group.length+1).trim().split(':');
		var name = '', quote = '';
		if(s.length == 1) {
			quote = s[0].trim();
		} else {
			name = s[0].trim();
			quote = s.slice(1).join(':').trim();
		}
		quotes[group] = quotes[group] || {};
		quotes[group][name] = quotes[group][name] || [];
		quotes[group][name].push(quote);

		return 'Quote of ' + name + ' added!';
	});

	for(var group in ALIAS) {
		var a = ALIAS[group];
		a = Array.isArray(a)? a: [a];
		for(var i = 0, l = a.length; i < l; i++) {
			var fn = function _t(o) {
				var name = o.rest.trim();
				var gr = _t.group;
				if(!quotes[gr])
					return 'Cannot find a quote group called ' + gr;
				if(!name) return getQuote(gr);
				var m = findMatch(name, keys(quotes[gr]));
				if(m) return getQuote(gr, m);
				return 'Could not find a quote.';
			};
			fn.group = ''+group;
			bot.addCommand('@' + a[i], fn);
		}
	}

	return {
		quotes: quotes,
		getQuote: getQuote
	};
}
