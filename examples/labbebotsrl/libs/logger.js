/* Logger lib for TwitchBot
 * @author: Albert ten Napel
 * @version: 0.3
 *
 * the log option for your TwitchBot must be true.
 *
 * 	Options: {
 * 		logPrivateMessages: whether to log private messages send to the bot,
 *		saveToFile: whether to save and load the player data to file,
 *		file: the file to use,
 *		saveInInterval: whether to save every so often,
 *		saveTime: if saveInInterval is true, how often to save in milliseconds,
 *		free: all users can use the loggers commands
 *	}
 *
 *	Mod commands:
 *		logs [amount of lines]: return the last [amount of lines] of the logs,
 *		searchlogs [text]: returns every line in the logs that contains [text],
 *		countlogs [text]: returns the amount of lines in the logs that contains [text],
 *		logssize: returns the amount of lines in the logs
 */
function(bot, twitchbot) {
	var config = bot.config.logger || {};
	var LOG_PRIVMSG = config.logPrivateMessages || false;
	var FILE = config.file || 'logs.json';
	var SAVE_TO_FILE = config.saveToFile || false;
	var SAVE_IN_INTERVAL = config.saveInInterval || false;
	var SAVE_TIME = config.saveTime || 60*1000;
	var FREE = config.free || false;

	var cmd = function(x) {return (FREE? '@': '') + x};

	var logs = [];
	if(SAVE_TO_FILE)
		logs = twitchbot.loadJSON('logs.json', []);
	bot.logger_logs = logs;

	if(SAVE_TO_FILE) {
		bot.onExit(function() {twitchbot.saveJSON(FILE, logs)});
		if(SAVE_IN_INTERVAL)
			setInterval(function() {twitchbot.saveJSON(FILE, logs)}, SAVE_TIME);
	}

	bot.addLogger(function(from, to, text, message) {
		var s = from + ': ' + text;
		if(to[0] == '#' || LOG_PRIVMSG) {
			console.log(s);
			logs.push(s);
		}
	});

	bot.addCommand(cmd('logs'), function(x) {
		var n = +x.rest;
		if(!isNaN(n) && n != 0)
			return logs.slice(n).join('\n');
	});
	
	bot.addCommand(cmd('searchlogs'), function(o) {
		var m = o.rest.toLowerCase();
		for(var i = 0, a = logs, l = a.length, r = []; i < l; i++) {
			var line = a[i].toLowerCase();
			if(line.indexOf(m) > -1) r.push(a[i]);
		}
		if(r.length == 0) return 'No matches';
		else return 'Found ' + r.length + ' matches\n' + r.join('\n');
	});

	bot.addCommand(cmd('countlogs'), function(o) {
		var m = o.rest.toLowerCase();
		for(var i = 0, a = logs, l = a.length, n = 0; i < l; i++) {
			var line = a[i].toLowerCase();
			if(line.indexOf(m) > -1) n++;
		}
		return '' + n;
	});

	bot.addCommand(cmd('logssize'), function() {
		return 'The logs file has ' + logs.length + ' lines.';
	});
}
