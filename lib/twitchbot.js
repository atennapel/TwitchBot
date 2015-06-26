/*	TwitchBot
 *	@author: Albert ten Napel
 *	@mail: aptennap@gmail.com 
 *	@version: 0.9.8
 *
 * 	Options: {
 *		server: the irc server, defaults to 'irc.twitch.tv'
 * 		port: the port of the irc, defaults to '6667'
 *		channel: the channel for the bot to join (can be a list, but not recommended)
 *		name: the (user)name of the bot
 *		password: the irc password (for twitch retrieve one at tmi.twitch.tv)
 *
 *		debug: whether to show irc debug messages
 *		log: whether to use loggers (like the logger plugin)
 *
 *		commandChar: the character that precedes commands, defaults to '!'
 *		varChar: the character to surrounds variables in commands, defaults to '`'
 *
 *		pluginsLocation: the directory where the plugins are stored (defaults to 'plugins')
 *		plugins: a list of which plugins to use (use 'all' to load all plugins in the plugins directory)
 *
 *		commands: a list (or object) of simple commands
 *		intervals: a list of {interval: [time in milliseconds], message: [message]} objects, these messages will be shown at their interval
 *
 *		disableCommands: a list of commands to be initially disabled
 *		freeCommands: a list of commands to be initially free
 *		modCommands: a list of commands to be initially mod-only
 *		removeCommands: a list of commands to be removed on startup
 *		alwaysMod: a list of names that will always be mods
 *		aliases: an object where the keys are commands and the values a list of aliases
 *		
 *		saveToFile: whether to save and load the bot (commands, vars and mods) to file,
 *		file: the file to use,
 *		saveInInterval: whether to save every so often,
 *		saveTime: if saveInInterval is true, how often to save in milliseconds
 *
 *		userDataSaveToFile: whether to save and load the user data to file,
 *		userDataFile: the file to use,
 *		userDataSaveInInterval: whether to save every so often,
 *		userDataSaveTime: if saveInInterval is true, how often to save in milliseconds
 *		
 *		userDataDefaults: an object of defaults to properties, for example: {"coins": 100, "wins": 10},
 *
 *		enableWhispers: true or false, enables the whisper method (twitch-specific feature)
 *	}
 */

var TWITCH_IRC_SERVER = 'irc.twitch.tv'; 
var TWITCH_GROUP_CHAT = '199.9.253.119';
var TWITCH_IRC_PORT 	= 6667;
var COMMAND_CHAR 			= '!';
var VAR_CHAR 					= '`';
var NOT_MOD 					= 1;
var MOD								= 2;
var SAVEABLE_PROPS 		= ['commands', 'vars', '_alwaysMod'];
var MERGING_PROPS 		= ['commands', 'vars'];

var wrap = function(a) {return Array.isArray(a)? a: [a]};
var normalizeChannel = function(ch) {return !ch? false: ch[0] != '#'? '#' + ch: ch};
var first = function(a, f) {for(var i = 0, l = a.length; i < l; i++) if(f(a[i])) return a[i]; return false};
var merge = function() {
	for(var i = 0, l = arguments.length, r = {}; i < l; i++)
		for(var k in arguments[i])
			r[k] = arguments[i][k];
	return r;
};
var isCommand = function(text, command, commandChar) {
	var text = text.toLowerCase(), command = command.toLowerCase();
	var l = command.length, k = commandChar.length;
	return text.slice(0, l+k) == commandChar + command && /\s/.test(text[l+k] || ' ');
};
var escapeForRegExp = function(c) {return '\\'+c};

var irc = require('irc');
var fs = require('fs');

function TwitchBot(o) {
	var o = arguments.length == 0?
						{}:
					typeof o == 'string'?
						loadJSON(o, {}): o;
	this.config 			= o;
	this.server 			= o.server 			|| TWITCH_IRC_SERVER;
	this.port 				= o.port 				|| TWITCH_IRC_PORT;
	this.commandChar 	= o.commandChar || COMMAND_CHAR;
	this.varChar		 	= o.varChar 		|| VAR_CHAR;
	this.debug				= o.debug 			|| false;
	this.log 					= o.log					|| false;
	this.loggers			= [];
	this._onexit 			= [];
	this._join 				= [];
	this._leave 			= [];

	this.name 				= (o.name || 'chatbot').toLowerCase();
	this.password 		= o.password;
	this.channel 			= wrap(o.channel).map(normalizeChannel);

	if(!this.name) 			throw 'No name provided.';
	if(!this.channel) 	throw 'No channel provided.';

	this.commands 		= {};
	this.comenabled		= {};
	this._alwaysMod 	= o.alwaysMod || [];
	this._users 			= {};
	this.userDefaults = o.userDataDefaults || {};

	var t = function() {var u = this.users(); return u[0|u.length*Math.random()]};
	this.vars 				= {
		name: this.name,
		channel: this.channel,
		server: this.server,
		post: this.port,
		commandChar: this.commandChar,
		users: function() {return this.users().join(', ')},
		mods: function() {return this.mods().join(', ')},
		commands: function() {return this.getCommands().join(', ')},
		freecommands: function() {return this.getFreeCommands().join(', ')},
		user: t,
		randuser: t
	};

	// saving
	this.file = o.file || 'bot.json';
	this._autosave = o.saveToFile || o.saveInInterval || false;

	if(o.saveInInterval)
		setInterval(this.autosave.bind(this), o.saveTime || 60*1000);

	if(this._autosave) this.load(this.file);
	
	// saving user data
	this.userData 		= {};
	this.userDataFile = o.userDataFile || 'userdata.json';
	this._userDataAutosave = o.userDataSaveToFile || o.userDataSaveInInterval || false;

	if(o.userDataSaveInInterval)
		setInterval((function() {
			saveJSON(this.userDataFile, this.userData);
		}).bind(this), o.userDataSaveTime || 60*1000);

	if(this._userDataAutosave)
		this.userData = loadJSON(this.userDataFile);

	// rest
	if(o.plugins || o.pluginsLocation) {
		var folder = o.pluginsLocation || 'plugins';
		if(o.plugins == 'all' || !o.plugins) this.loadPlugins(folder);
		else this.loadPlugins(folder, o.plugins);
	}

	if(o.commands) {
		var com = o.commands;
		if(!Array.isArray(com)) {
			var c = [];
			for(var k in com)
				c.push(k, com[k]);
			com = c;
		}
		this.addCommands.apply(this, com);
	}
	
	if(o.intervals) {
		for(var i = 0, a = o.intervals, l = a.length; i < l; i++) {
			var c = a[i];
			var t = c.interval || 1000*60*10;
			var m = c.message;
			this.addIntervalMessage(m, t);
		}
	}

	if(o.freeCommands) {
		for(var i = 0, a = o.freeCommands, l = a.length; i < l; i++)
			if(this.commands[a[i]])
				this.commands[a[i]].free = true;
	}
	if(o.modCommands) {
		for(var i = 0, a = o.modCommands, l = a.length; i < l; i++)
			if(this.commands[a[i]])
				this.commands[a[i]].free = false;
	}
	if(o.disableCommands) {
		for(var i = 0, a = o.disableCommands, l = a.length; i < l; i++)
			this.disableCommand(a[i]);
	}
	if(o.removeCommands) {
		for(var i = 0, a = o.removeCommands, l = a.length; i < l; i++)
			delete this.commands[a[i]];
	}
	if(o.aliases) {
		for(var c in o.aliases) {
			var a = o.aliases[c];
			for(var i = 0, l = a.length; i < l; i++)
				this.commands[a[i]] = this.commands[c];
		}
	}
	if(o.enableWhispers) {
		if(this.channel.length != 1) 
			throw new Error('Whispers only work when connected to exactly one channel.');
		else this.enableWhispers = true;
	}
};

TwitchBot.prototype.users = function() {return Object.keys(this._users)};
TwitchBot.prototype.mods = function() {var r = []; for(var name in this._users) if(this.isMod(name)) r.push(name); return r};
TwitchBot.prototype.isMod = function(name) {var name = name.toLowerCase(); return this._users[name] == MOD || this._alwaysMod.indexOf(name) > -1};
TwitchBot.prototype.addMod = function(name) {var name = name.toLowerCase(); if(this._users[name]) this._users[name] = MOD; return this};
TwitchBot.prototype.removeMod = function(name) {var name = name.toLowerCase(); if(this._users[name]) this._users[name] = NOT_MOD; return this};
TwitchBot.prototype.alwaysMod = function(name) {var name = name.toLowerCase(); this._alwaysMod.push(name); return this};

TwitchBot.prototype.getCommands = function() {return Object.keys(this.commands)};
TwitchBot.prototype.getFreeCommands = function() {
	var r = [];
	for(var k in this.commands)
		if(this.commands[k].free)
			r.push(k);
	return r;
};

TwitchBot.prototype.tryJoin = function(nick) {
	for(var i = 0, a = this._join, l = a.length; i < l; i++)
		a[i].call(this, nick);
};
TwitchBot.prototype.tryLeave = function(nick) {
	for(var i = 0, a = this._leave, l = a.length; i < l; i++)
		a[i].call(this, nick);
};
TwitchBot.prototype.doExit = function() {
	this.autosave();
	for(var i = 0, a = this._onexit, l = a.length; i < l; i++)
		a[i].call(this);
	process.exit();	
};

TwitchBot.prototype.disableCommand = function(name) {this.comdis[name] = true; return this};
TwitchBot.prototype.enableCommand = function(name) { this.comdis[name] = false; return this};

TwitchBot.prototype.run = function() {
	this.bot = new irc.Client(this.server, this.name, {
		port: 		this.port,
		channels: this.channel,
		password: this.password,
		username: this.name,
		debug: 		this.debug
	});
	this.bot.addListener('message', this.tryCommands.bind(this));
	this.bot.addListener('names' + this.channel, (function(nicks) {this._users = {}; for(var k in nicks) this._users[k] = true}).bind(this));
	this.bot.addListener('join' + this.channel, (function(nick) {this.tryJoin(nick); this._users[nick] = NOT_MOD}).bind(this));
	this.bot.addListener('part' + this.channel, (function(nick) {this.tryLeave(nick); delete this._users[nick]}).bind(this));
	this.bot.addListener('+mode', (function(channel, by, mode, argument, msg) {if(mode == 'o') this._users[msg.args[2]] = MOD}).bind(this));
	this.bot.addListener('-mode', (function(channel, by, mode, argument, msg) {if(mode == 'o') this._users[msg.args[2]] = NOT_MOD}).bind(this));
	process.on('SIGINT', this.doExit.bind(this));
	process.on('SIGTERM', this.doExit.bind(this));
	process.on('SIGQUIT', this.doExit.bind(this));
	if(this.debug) this.bot.addListener('error', function(msg) {console.log('Error: ', msg)});

	if(this.enableWhispers) {
		this.whisperbot = new irc.Client(TWITCH_GROUP_CHAT, this.name, {
			port: 		this.port,
			channels: this.channel,
			password: this.password,
			username: this.name,
			debug: 		this.debug
		});
		this.whisperbot.addListener('raw', (function(msg) {
			if(msg.command === 'WHISPER' && msg.args[0] === this.name) {
				var from = msg.user;
				var message = msg.args[1];
				if(this.whispercb) this.whispercb(from, message);
			}
		}).bind(this));
		this.whisperbot.addListener('join' + this.channel, (function(nick, message) {
			if(nick === this.name) {
				this.whisperbot.send('CAP REQ', 'twitch.tv/commands');
			}
		}).bind(this));
		if(this.debug) this.whisperbot.addListener('error', function(msg) {console.log('Whisper Error: ', msg)});
	}

	return this;
};

TwitchBot.prototype.doMessage = function(text, from, to, msg) {return this.tryCommands(from || this.name, to || this.channel, text || '', msg || {})};

TwitchBot.prototype.callLoggers = function(from, to, text, message) {
	if(this.log && this.loggers.length > 0) {
		for(var i = 0, a = this.loggers, l = this.loggers.length; i < l; i++)
			a[i](from, to, text, message);
	}
};

TwitchBot.prototype.tryCommands = function(from, to, text, message) {
	var message = message || {};
	this.callLoggers(from, to, text, message);
	if(text.length > this.commandChar.length && text[0] == this.commandChar) {
		var command = text.slice(this.commandChar.length).split(/\s+/g)[0].toLowerCase();
		var o = {from: from, to: to, text: text, message: message};
		if(typeof command == 'string') {
			o.rest = text.slice(command.length+1).trim();
			o.args = o.rest.split(/\s+/g).map(function(x) {var t = +x; return isNaN(t)? x: t});
		}
		var text = this.replaceVars(text, o);
		var mod = this.isMod(from);
		
		if(this.commands[command]) {
			var obj = this.commands[command];
			if(mod || obj.free) {
				var s = this.doCommand(command, obj.result, from, to, text, message);
				if(typeof s == 'string') {
					if(message.args[0] == this.name)
						this.say(s, from);
					else
						this.say(s);
				}
			}
		}
	}
};

TwitchBot.prototype.doCommand = function(command, result, from, to, text, message) {
	var o = {command: command, from: from, to: to, text: text, message: message};
	if(typeof command == 'string') {
		o.rest = text.slice(command.length+1).trim();
		o.args = o.rest.split(/\s+/g).map(function(x) {var t = +x; return isNaN(t)? x: t});
	}
	if(typeof result == 'string')
		return this.replaceVars(result, o);
	else if(typeof result == 'function') return result.call(this, o);
	else throw 'Invalid result type';
};

TwitchBot.prototype.replaceVars = function(str, env) {
	var env = merge(this.vars, env);
	var ch = escapeForRegExp(this.varChar);
	return str.replace(new RegExp(ch + '[a-z0-9]+' + ch, 'g'), (function(s, i) {
		if(str[i-1] == this.varChar) return s.slice(1);
		var v = s.slice(1, -1), vn = +v;
		if(!isNaN(vn)) {
			if(typeof env.command != 'string') throw 'Invalid command type';
			return ''+env.text.slice(env.command.length).trim().split(/\s+/g)[vn];
		}

		if(!env[v]) return s; 
		
		return typeof env[v] == 'function'?	env[v].call(this, env): env[v];
	}).bind(this));
};

TwitchBot.prototype.whisper = function(user, msg) {
	if(this.enableWhispers) {
		this.whisperbot.send('PRIVMSG', '#jtv', '/w ' + user + ' ' + msg);
	} else console.log('Trying to use whispers when they\'re not enabled!');
};
TwitchBot.prototype.say = function(text, ch) {
	this.bot.say(ch || this.channel, text);
	this.callLoggers(this.name, ch || this.channel, text, null);
	return this;
};
TwitchBot.prototype.sayWithVars = function(text, o) {
	var o = o || {};
	o.text = text;
	var s = this.replaceVars(text, o);
	this.bot.say(this.channel, s);
	this.callLoggers(this.name, this.channel, s, null);
	return this;
};
TwitchBot.prototype.getVar = function(name) {this.vars[name]};

TwitchBot.prototype.onJoin = function(f) {this._join.push(f); return this};
TwitchBot.prototype.onLeave = function(f) {this._leave.push(f); return this};
TwitchBot.prototype.onWhisper = function(f) {this.whispercb = f; return this};

TwitchBot.prototype.onExit = function(f) {this._onexit.push(f); return this};
TwitchBot.prototype.addLogger = function(f) {this.loggers.push(f); return this};

TwitchBot.prototype.addIntervalMessage = function(msg, time, o) {setInterval((function() {this.sayWithVars(msg, o)}).bind(this), time); return this};
TwitchBot.prototype.addTimeoutMessage = function(msg, time, o) {setTimeout((function() {this.sayWithVars(msg, o)}).bind(this), time); return this};

TwitchBot.prototype.removeCommands = function() {
	for(var i = 0, l = arguments.length; i < l; i++)
		delete this.commands[arguments[i]];
	return this;
}

TwitchBot.prototype.removeCommand = TwitchBot.prototype.removeCommands;

TwitchBot.prototype.makeCommandFree = function(command) {
	if(this.commands[command]) this.commands[command].free = true;
	return this;
};
TwitchBot.prototype.makeCommandModOnly = function(command) {
	if(this.commands[command]) this.commands[command].free = false;
	return this;
};

TwitchBot.prototype.addCommands = function() {
	for(var i = 0, l = arguments.length; i < l; i += 2) {
		var command = arguments[i], ret = arguments[i+1];
		if(Array.isArray(command)) {
			for(var j = 0, k = command.length; j < k; j++) {
				var cmd = command[j];
				var free = false;
				if(cmd[0] == '@') cmd = cmd.slice(1), free = true; 
				this.commands[cmd] = {command: cmd, result: ret, free: free};
			}
		} else if(typeof command == 'string') {
			var free = false;
			if(command[0] == '@') command = command.slice(1), free = true; 
			this.commands[command.toLowerCase()] = {command: command.toLowerCase(), result: ret, free: free};
		} else {
			this.commands[command.command] = command, i--;
		}
	}
	return this;
};

TwitchBot.prototype.addCommand = TwitchBot.prototype.addCommands;

TwitchBot.prototype.addVars = function() {
	for(var i = 0, l = arguments.length; i < l; i += 2) {
		var a = arguments[i], b = arguments[i+1];
		if(typeof a == 'string') this.vars[a] = b;
		else if(Array.isArray(a)) {
			for(var j = 0, k = a.length; j < k; j++) this.vars[a[j]] = b;
		} else {
			for(var k in a) this.vars[k] = a[k];
			i--;
		}
	}
	return this;
};

TwitchBot.prototype.addVar = TwitchBot.prototype.addVars;

TwitchBot.prototype.loadPlugin = function(file) {
	if(!/.*\.js/i.test(file)) file += '.js';
	var t = file.split('/');
	var name = t[t.length-1].split('.').slice(0, -1).join('.');
	var f = fs.readFileSync(file).toString();
	var fn = eval('('+f+')');
	this[name] = fn.call(this, this, twitchbot) || {};
	return this;
};

TwitchBot.prototype.loadPlugins = function(files, a) {
	if(Array.isArray(files)) files.forEach(this.loadPlugin.bind(this));
	else {
		var fl = fs.readdirSync(files).filter(function(x) {return /.*\.js/i.test(x)}).forEach((function(x) {
			if(!a || a.indexOf(x) > -1) this.loadPlugin.call(this, files+'/'+x);
		}).bind(this));
	}
	return this;
};

TwitchBot.prototype.autosave = function() {if(this._autosave) this.save(this.file); return this};

TwitchBot.prototype.save = function(file) {
	for(var i = 0, a = SAVEABLE_PROPS, l = a.length, o = {}; i < l; i++) {
		var c = a[i];
		o[c] = anyToJSONObj(this[c]);
	}
	fs.writeFileSync(file, JSON.stringify(o));
	return this;
};

TwitchBot.prototype.load = function(file) {
	try {
		var o = anyFromJSONObj(JSON.parse(fs.readFileSync(file)));
		for(var k in o) {
			if(MERGING_PROPS.indexOf(k) == -1)
				this[k] = o[k];
			else
				this[k] = merge(this[k] || {}, o[k]);
		}
	} catch (err) {
		if(err.errno == 34) return this;
		else throw err;
	}
	return this;
};

TwitchBot.prototype.checkUser = function(name) {
	var name = name.trim().toLowerCase();
	if(!name) throw 'Empty name!';
	this.userData[name] = this.userData[name] || {}; 
	return name;
};

TwitchBot.prototype.getDataUsers = function() {
	return Object.keys(this.userData);
};

TwitchBot.prototype.getAllData = function() {
	return this.userData;
};

TwitchBot.prototype.getData = function(name, o) {
	if(o) for(var k in o) this.get(name, k, o[k]);
	return this.userData[this.checkUser(name)];
};

TwitchBot.prototype.get = function(name, prop, d) {
	var name = this.checkUser(name);
	var v = this.userData[name][prop];
	if(typeof v == 'undefined') {
		if(typeof this.userDefaults[prop] != 'undefined') {
			var d = this.userDefaults[prop];
			this.userData[name][prop] = d;
			return d;
		} else if(typeof d != 'undefined') {
			this.userData[name][prop] = d;
			return d;
		}
	}
	return v;
};

TwitchBot.prototype.set = function(name, prop, v) {
	var name = this.checkUser(name);
	return this.userData[name][prop] = typeof v == 'function'? v(this.get(name, prop)): v;
};

TwitchBot.prototype.setAll = function(name, o) {
	for(var k in o)
		this.set(name, k, o[k]);
	return this.getData(name);
};

var anyToJSONObj = function(x) {
	if(Array.isArray(x)) return {type: 'array', val: x.map(anyToJSONObj)};
	else if(typeof x == 'function') return {type: 'function', val: x.toString()};
	else if(typeof x == 'string') return {type: 'string', val: x};
	else if(typeof x == 'number') return {type: 'number', val: ''+x};
	else if(typeof x == 'boolean') return {type: 'boolean', val: ''+x};
	else if(x instanceof RegExp) return {type: 'regexp', val: x.toString()};
	else {
		var o = {};
		for(var k in x) o[k] = anyToJSONObj(x[k]);
		return {type: 'object', val: o};
	}
};

var anyFromJSONObj = function(x) {
	var t = x.type;
	if(!t) x = {val: x}, t = 'object';
	if(t == 'array') return x.val.map(anyFromJSONObj);
	else if(t == 'function') return eval('('+x.val+')');
	else if(t == 'string') return ''+x.val;
	else if(t == 'number') return +x.val;
	else if(t == 'boolean') return x.val == 'true';
	else if(t == 'regexp') return eval('('+x.val+')');
	else if(t == 'object') {
		var o = x.val, no = {};
		for(var k in o) no[k] = anyFromJSONObj(o[k]);
		return no;
	} else return undefined;
};

var loadJSON = function(fname, v, fn) {
	if(fn) {
		return fs.readFile(fname, function(err, data) {
			if(err) {
				if(err.errno == 34) fn(err, v || {});
				else f(err);
			} else {
				try {
					fn(err, JSON.parse(data));
				} catch (e) {
					console.log('Error parsing JSON file: ' + e);
					throw e;
				}
			}
		});
	} else {
		try {
			return JSON.parse(fs.readFileSync(fname));
		} catch (err) {
			if(err.errno == 34) return v || {};
			else {
				console.log('Error parsing JSON file: ' + err);
				throw err;
			}
		}
	}
};

var saveJSON = function(fname, obj, fn) {
	if(fn) {
		return fs.writeFile(fname, JSON.stringify(obj), fn);
	} else {
		return fs.writeFileSync(fname, JSON.stringify(obj));
	}
};

function JSONFile(file, val) {
	this.file = file;
	this.val = val;
};

JSONFile.prototype.save = function(fn) {
	saveJSON(this.file, this.val, fn);
	return this;
};

JSONFile.prototype.load = function(v, fn) {
	this.val = loadJSON(this.file, v, fn);
	return this;
};

JSONFile.prototype.onExitSave = function(bot) {
	bot.onExit(this.save.bind(this));
	return this;
};

JSONFile.prototype.saveEvery = function(time) {
	this.interval = setInterval(this.save.bind(this), time);
	return this;
};

JSONFile.prototype.stopSaving = function() {
	clearInterval(this.interval);
	return this;
};

JSONFile.prototype.get = function() {
	return this.val;
};

JSONFile.prototype.set = function(val) {
	this.val = val;
	return this;
};

function create(o) {
	var bot = new TwitchBot(o);
	bot.run();
	return bot;
};

var twitchbot = {
	TwitchBot: TwitchBot,
	loadJSON: loadJSON,
	saveJSON: saveJSON,
	JSONFile: JSONFile,
	create: create
};

module.exports = twitchbot;
