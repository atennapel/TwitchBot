/* Logger lib for TwitchBot
 * @author: Albert ten Napel
 * @version: 0.5
 *
 * Adds a simple logging system to the bot.
 * The log option for your TwitchBot must be true.
 *
 * 	Options: {
 * 		logPrivateMessages: whether to log private messages send to the bot,
 * 		logToConsole: whether to log to the console,
 *		saveToFile: whether to save and load the player data to file,
 *		file: the file to use,
 *		saveInInterval: whether to save every so often,
 *		saveTime: if saveInInterval is true, how often to save in milliseconds,
 *		free: all users can use the loggers commands,
 *		format: the format how to log the messages, the variables that can be used are:
 *			$date, $from, $to, $message, $day, $year, $hours, $minutes, $month
 *		server: whether to host a server that shows the logs
 *		ip: ip of the server
 *		port: port of the server
 *	}
 *
 *	Mod commands:
 *		logs [amount of lines]: return the last [amount of lines] of the logs,
 *		searchlogs [text]: returns every line in the logs that contains [text],
 *		countlogs [text]: returns the amount of lines in the logs that contains [text],
 *		searchlogsfrom [from] [text]: returns every line in the logs from [from] that contains [text],
 *		countlogsfrom [from] [text]: returns the amount of lines in the logs from [from] that contains [text],
 *		logssize: returns the amount of lines in the logs
 */
function(bot, twitchbot) {
	var config = bot.config.logger || {};
	var LOG_PRIVMSG = config.logPrivateMessages || false;
	var LOG_CONSOLE = config.logToConsole || false;
	var FILE = config.file || 'logs.json';
	var SAVE_TO_FILE = config.saveToFile || false;
	var SAVE_IN_INTERVAL = config.saveInInterval || false;
	var SAVE_TIME = config.saveTime || 60*1000;
	var FREE = config.free || false;
	var FORMAT = config.format || '$date $from: $message';
	var SERVER = config.server || false;
	var PORT = config.logtime || 80;
	var IP = config.logtime || '127.0.0.1';

	function cmd(x) {return (FREE? '@': '') + x};

	var logs = [];
	if(SAVE_TO_FILE) {
		var file = new twitchbot.JSONFile(FILE);
		file.onExitSave(bot);
		if(SAVE_IN_INTERVAL) file.saveEvery(SAVE_TIME);
		logs = file.load([]).get();
	}

	function format(o) {
		if(typeof o == 'string') return o;
		var date = o.date;
		var from = o.from;
		var to = o.to;
		var message = o.message;
		var date = new Date(o.date);
		var vars = {
			date: ''+date,
			from: from,
			to: to,
			message: message,
			day: date.getDate(),
			year: date.getFullYear(),
			hours: date.getHours(),
			minutes: date.getMinutes(),
			month: date.getMonth()
		};
		return FORMAT.replace(/\$[a-z]+/gi,
			function(x) {return vars[x.slice(1)] || ''});
	}

	function showLogs(a) {
		return (a || logs).map(format).join('\n');
	}

	bot.addLogger(function(from, to, text, message) {
		var isCh = Array.isArray(to)? to[0][0] == '#': to[0] == '#';
		var o = {
			date: Date.now(),
			from: from,
			to: to,
			message: text
		};
		if(isCh || LOG_PRIVMSG) {
			if(LOG_CONSOLE) console.log(format(o));
			logs.push(o);
		}
	});

	bot.addCommand(cmd('logs'), function(x) {
		var n = +x.rest;
		if(!isNaN(n) && n != 0)
			return showLogs(logs.slice(n));
	});
	
	bot.addCommand(cmd('searchlogs'), function(o) {
		var m = o.rest.trim().toLowerCase();
		for(var i = 0, a = logs, l = a.length, r = []; i < l; i++) {
			var c = a[i];
			if(typeof c == 'string') {
				var line = c.trim().toLowerCase();
				if(line.indexOf(m) > -1) r.push(c);
			} else {
				var line = c.text.trim().toLowerCase();
				if(line.indexOf(m) > -1) r.push(c);
			}
		}
		if(r.length == 0) return 'No matches';
		else return 'Found ' + r.length + ' matches\n' + showLogs(r).join('\n');
	});

	bot.addCommand(cmd('searchlogsfrom'), function(o) {
		var name = o.args[0].trim().toLowerCase();
		var m = o.rest.slice(name.length+1).trim().toLowerCase();
		for(var i = 0, a = logs, l = a.length, r = []; i < l; i++) {
			var c = a[i];
			if(typeof c == 'string') {
				var t = c.toLowerCase();
				var spl = t.split(':');
				var from = t[0].toLowerCase().trim();
				var line = t.slice(1).join(':').trim();
				if(from == name && line.indexOf(m) > -1) r.push(c);
			} else {
				var line = c.text.toLowerCase();
				if(c.from.toLowerCase() == name && line.indexOf(m) > -1) r.push(c);
			}
		}
		if(r.length == 0) return 'No matches';
		else return 'Found ' + r.length + ' matches\n' + showLogs(r).join('\n');
	});

	bot.addCommand(cmd('countlogs'), function(o) {
		var m = o.rest.trim().toLowerCase();
		for(var i = 0, a = logs, l = a.length, r = 0; i < l; i++) {
			var c = a[i];
			if(typeof c == 'string') {
				var line = c.trim().toLowerCase();
				if(line.indexOf(m) > -1) r++;
			} else {
				var line = c.text.trim().toLowerCase();
				if(line.indexOf(m) > -1) r++;
			}
		}
		if(r.length == 0) return 'No matches';
		else return 'Found ' + r + ' matches';
	});

	bot.addCommand(cmd('countlogsfrom'), function(o) {
		var name = o.args[0].trim().toLowerCase();
		var m = o.rest.slice(name.length+1).trim().toLowerCase();
		for(var i = 0, a = logs, l = a.length, r = 0; i < l; i++) {
			var c = a[i];
			if(typeof c == 'string') {
				var t = c.toLowerCase();
				var spl = t.split(':');
				var from = t[0].toLowerCase().trim();
				var line = t.slice(1).join(':').trim();
				if(from == name && line.indexOf(m) > -1) r++;
			} else {
				var line = c.text.toLowerCase();
				if(c.from.toLowerCase() == name && line.indexOf(m) > -1) r++;
			}
		}
		if(r.length == 0) return 'No matches';
		else return 'Found ' + r + ' matches';
	});

	bot.addCommand(cmd('logssize'), function() {
		return 'The logs file has ' + logs.length + ' lines.';
	});

	if(SERVER) {
		var http = require('http');
		var server = http.createServer(function(req, res) {
			res.end(showLogs());
		});
		server.listen(PORT, IP);
	}

	return {
		logs: logs
	};
}
