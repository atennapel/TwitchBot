/*	TwitchBot
 *	@author: Albert ten Napel
 *	@mail: aptennap@gmail.com 
 *	@version: 0.8.4
 */

var TWITCH_IRC_SERVER = 'irc.twitch.tv'; 
var TWITCH_IRC_PORT 	= 6667;
var COMMAND_CHAR 			= '!';
var VAR_CHAR 					= '`';
var NOT_MOD 					= 1;
var MOD								= 2;
var SAVEABLE_PROPS 		= ['commands', 'vars'];
var MERGING_PROPS = ['commands', 'vars'];

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

var TwitchBot = function(o) {
	this.server 			= o.server 			|| TWITCH_IRC_SERVER;
	this.port 				= o.port 				|| TWITCH_IRC_PORT;
	this.commandChar 	= o.commandChar || COMMAND_CHAR;
	this.varChar		 	= o.varChar 		|| VAR_CHAR;
	this.debug				= o.debug 			|| false;
	this._autosave 		= o.autosave 		|| false;

	this.name 				= o.name;
	this.password 		= o.password;
	this.channel 			= normalizeChannel(o.channel);

	if(!this.name) 			throw 'No name provided.';
	if(!this.password) 	throw 'No password provided.';
	if(!this.channel) 	throw 'No channel provided.';

	this.commands 		= {};
	this._users 			= {};

	this.vars 				= {
		name: this.name,
		channel: this.channel,
		server: this.server,
		post: this.port,
		commandChar: this.commandChar,
		users: function() {return this.users().join(', ')},
		mods: function() {return this.mods().join(', ')},
		commands: function() {return Object.keys(this.commands).join(', ')},
		freecommands: function() {
			var r = [];
			for(var k in this.commands)
				if(this.commands[k].free)
					r.push(k);
			return r.join(', ');
		}
	};
};

TwitchBot.prototype.users = function() {return Object.keys(this._users)};
TwitchBot.prototype.mods = function() {var r = []; for(var name in this._users) if(this._users[name] == MOD) r.push(name); return r};
TwitchBot.prototype.isMod = function(name) {return this._users[name] == MOD};

TwitchBot.prototype.run = function() {
	this.bot = new irc.Client(this.server, this.name, {
		port: 		this.port,
		channels: [this.channel],
		password: this.password,
		username: this.name,
		debug: 		this.debug
	});
	this.bot.addListener('message', this.tryCommands.bind(this));
	this.bot.addListener('names' + this.channel, (function(nicks) {this._users = {}; for(var k in nicks) this._users[k] = true}).bind(this));
	this.bot.addListener('join' + this.channel, (function(nick) {if(typeof this._join == 'function') this._join.call(this, nick); this._users[nick] = NOT_MOD}).bind(this));
	this.bot.addListener('part' + this.channel, (function(nick) {if(typeof this._leave == 'function') this._leave.call(this, nick); delete this._users[nick]}).bind(this));
	this.bot.addListener('+mode', (function(channel, by, mode, argument, msg) {if(mode == 'o') this._users[msg.args[2]] = MOD}).bind(this));
	this.bot.addListener('-mode', (function(channel, by, mode, argument, msg) {if(mode == 'o') this._users[msg.args[2]] = NOT_MOD}).bind(this));
	if(this.debug) this.bot.addListener('error', function(msg) {console.log('error: ', msg)});
	return this;
};

TwitchBot.prototype.doMessage = function(text, from, to, msg) {return this.tryCommands(from || this.name, to || this.channel, text || '', msg || {})};

TwitchBot.prototype.tryCommands = function(from, to, text, message) {
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
				if(typeof s == 'string') this.say(s);
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

TwitchBot.prototype.say = function(text) {this.bot.say(this.channel, text); return this};
TwitchBot.prototype.sayWithVars = function(text, o) {var o = o || {}; o.text = text; this.bot.say(this.channel, this.replaceVars(text, o)); return this};
TwitchBot.prototype.getVar = function(name) {this.vars[name]};

TwitchBot.prototype.onJoin = function(f) {this._join = f; return this};
TwitchBot.prototype.onLeave = function(f) {this._leave = f; return this};

TwitchBot.prototype.addIntervalMessage = function(msg, time, o) {setInterval((function() {this.sayWithVars(msg, o)}).bind(this), time); return this};
TwitchBot.prototype.addTimeoutMessage = function(msg, time, o) {setTimeout((function() {this.sayWithVars(msg, o)}).bind(this), time); return this};

TwitchBot.prototype.removeCommands = function() {
	for(var i = 0, l = arguments.length; i < l; i++)
		delete this.commands[arguments[i]];
	this.autosave();
	return this;
}

TwitchBot.prototype.removeCommand = TwitchBot.prototype.removeCommands;

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
	this.autosave();
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
	this.autosave();
	return this;
};

TwitchBot.prototype.addVar = TwitchBot.prototype.addVars;

TwitchBot.prototype.loadMod = function(file) {
	if(!/.*\.js/i.test(file)) file += '.js';
	fs.readFile(file, (function(err, f) {
		if(err) throw err;
		eval('('+f+')').call(this, this, twitchbot);
	}).bind(this));
	return this;
};

TwitchBot.prototype.loadMods = function(files) {
	if(Array.isArray(files)) files.forEach(this.loadMod.bind(this));
	else fs.readdir(files, (function(err, fl) {
		if(err) throw err;
		fl.filter(function(x) {return /.*\.js/i.test(x)}).forEach((function(x) {
			this.loadMod.call(this, files+'/'+x);
		}).bind(this));
	}).bind(this));
	return this;
};

TwitchBot.prototype.setAutosave = function(file) {return this._autosave = file, this};
TwitchBot.prototype.autosave = function() {if(this._autosave) this.save(this._autosave); return this};

TwitchBot.prototype.save = function(file) {
	for(var i = 0, a = SAVEABLE_PROPS, l = a.length, o = {}; i < l; i++) {
		var c = a[i];
		o[c] = anyToJSONObj(this[c]);
	}
	fs.writeFile(file, JSON.stringify(o), function(err) {if(err) throw err});
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
	}
};

var loadJSON = function(fname, fn) {
	if(fn) {
		return fs.readFile(fname, function(err, data) {
			if(err) {
				if(err.errno == 34) fn({});
				else console.log(err);
			} else fn(JSON.parse(data));
		});
	} else {
		try {
			return JSON.parse(fs.readFileSync(fname));
		} catch (err) {
			if(err.errno == 34) return {};
			else console.log(err);
		}
	}
}

var saveJSON = function(fname, obj, fn) {
	if(fn) {
		return fs.writeFile(fname, JSON.stringify(obj), function(err) {
			if(err) console.log(err);
			else if(typeof fn == 'function') fn();
		});
	} else {
		try {
			return fs.writeFileSync(fname, JSON.stringify(obj));
		} catch (err) {
			console.log(err);	
		}
	}
}

var twitchbot = {
	TwitchBot: TwitchBot,
	loadJSON: loadJSON,
	saveJSON: saveJSON
};

module.exports = twitchbot;
