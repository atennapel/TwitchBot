/*	TwitchBot
 *	@author: Albert ten Napel
 *	@mail: aptennap@gmail.com 
 *	@version: 0.4
 */

var TWITCH_IRC_SERVER = 'irc.twitch.tv'; 
var TWITCH_IRC_PORT 	= 6667;
var COMMAND_CHAR 			= '!';
var NOT_MOD 					= 1;
var MOD								= 2;

var normalizeChannel = function(ch) {return !ch? false: ch[0] != '#'? '#' + ch: ch};
var first = function(a, f) {for(var i = 0, l = a.length; i < l; i++) if(f(a[i])) return a[i]; return false};
var merge = function() {
	for(var i = 0, l = arguments.length, r = {}; i < l; i++)
		for(var k in arguments[i])
			r[k] = arguments[i][k];
	return r;
};
var isCommand = function(text, command, commandChar) {
	var l = command.length, k = commandChar.length;
	return text.slice(0, l+k) == commandChar + command && /\s/.test(text[l+k] || ' ');
};

var irc = require('irc');

var TwitchBot = function(o) {
	this.server 			= o.server 			|| TWITCH_IRC_SERVER;
	this.port 				= o.port 				|| TWITCH_IRC_PORT;
	this.commandChar 	= o.commandChar || COMMAND_CHAR;
	this.debug				= o.debug 			|| false

	this.name 				= o.name;
	this.password 		= o.password;
	this.channel 			= normalizeChannel(o.channel);

	if(!this.name) 			throw 'No name provided.';
	if(!this.password) 	throw 'No password provided.';
	if(!this.channel) 	throw 'No channel provided.';

	this.commands 		= [];
	this._users 			= {};

	this.vars 				= {
		name: this.name,
		channel: this.channel,
		server: this.server,
		post: this.port,
		commandChar: this.commandChar,
		users: function() {return this.users().join(', ')},
		mods: function() {return this.mods().join(', ')}
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
	this.bot.addListener('join' + this.channel, (function(nick) {this._users[nick] = NOT_MOD}).bind(this));
	this.bot.addListener('part' + this.channel, (function(nick) {delete this._users[nick]}).bind(this));
	this.bot.addListener('+mode', (function(channel, by, mode, argument, msg) {if(mode == 'o') this._users[msg.args[2]] = MOD}).bind(this));
	this.bot.addListener('-mode', (function(channel, by, mode, argument, msg) {if(mode == 'o') this._users[msg.args[2]] = NOT_MOD}).bind(this));
	if(this.debug) this.bot.addListener('error', function(msg) {console.log('error: ', msg)});
	return this;
};

TwitchBot.prototype.doMessage = function(text, from, to, msg) {return this.tryCommands(from || this.name, to || this.channel, text || '', msg || {})};

TwitchBot.prototype.tryCommands = function(from, to, text, message) {
	var mod = this.isMod(from);
	for(var i = 0, a = this.commands, l = this.commands.length; i < l; i++) {
		var c = a[i], cmd = c.command, res = c.result, r = false;
		if(mod || c.free) {
			if(Array.isArray(cmd)) {
				for(var j = 0, k = cmd.length; j < k; j++) if(this.tryCommand(cmd[i], from, to, text, message)) {
					r = res;
					break;
				}
			} else if(this.tryCommand(cmd, from, to, text, message)) r = res;
			if(r) break;
		}
	}
	if(r) {
		var s = this.doCommand(cmd, r, from, to, text, message);
		if(typeof s == 'string') this.say(s);
	}
};

TwitchBot.prototype.tryCommand = function(command, from, to, text, message) {
	return 	Array.isArray(command)? first(a, this.tryCommand.bind(this)):
					command instanceof RegExp? command.test(text):
					typeof command == 'function'? command.bind(this)(from, text, to, message):
					typeof command == 'string'? isCommand(text, command.toLowerCase(), this.commandChar):
					false;
};

TwitchBot.prototype.doCommand = function(command, result, from, to, text, message) {
	var o = {command: command, from: from, to: to, text: text, message: message};
	if(typeof command == 'string') o.rest = text.slice(command.length+1).trim();
	if(typeof result == 'string')
		return this.replaceVars(result, o);
	else if(typeof result == 'function') return result.bind(this)(o);
	else throw 'Invalid result type';
};

TwitchBot.prototype.replaceVars = function(str, env) {
	var env = merge(this.vars, env);
	return str.replace(/\$[a-z0-9]+\$/g, function(s, i) {
		if(str[i-1] == '$') return s.slice(1, -1);
		var v = s.slice(1, -1), vn = +v;
		if(!isNaN(vn)) {
			if(typeof env.command != 'string') throw 'Invalid command type';
			return ''+env.text.slice(env.command.length).trim().split(/\s+/g)[vn];
		}

		if(!env[v]) return s; 
		
		return typeof env[v] == 'function'?	env[v].bind(this)(env): env[v];
	});
};

TwitchBot.prototype.say = function(text) {this.bot.say(this.channel, text); return this};

TwitchBot.prototype.addCommands = function() {
	for(var i = 0, l = arguments.length; i < l; i += 2) {
		var command = arguments[i], ret = arguments[i+1];
		if(command instanceof RegExp || typeof command == 'function')
			this.commands.push({command: command, result: ret});
		else if(typeof command == 'string')
			this.commands.push({command: command.toLowerCase(), result: ret});
		else this.commands.push(command), i--;
	}
	return this;
};

TwitchBot.prototype.addCommand = TwitchBot.prototype.addCommands;

TwitchBot.prototype.addVars = function() {
	for(var i = 0, l = arguments.length; i < l; i += 2) {
		var a = arguments[i], b = arguments[i+1];
		if(typeof a == 'string') this.vars[a] = b;
		else {
			for(var k in a) this.vars[k] = a[k];
			i--;
		}
	}
	return this;
};

TwitchBot.prototype.addVar = TwitchBot.prototype.addVars;

var loadJSON = function(fname) {
	try {
		return JSON.parse(fs.readFileSync(fname));
	} catch (err) {
		if(err.errno == 34) return {};
		else console.log(err);
	}
}

var saveJSON = function(fname, obj) {
	try {
		return fs.writeFileSync(fname, JSON.stringify(obj));
	} catch (err) {
		console.log(err);	
	}
}

module.exports.TwitchBot = TwitchBot;
module.exports.loadJSON = loadJSON;
module.exports.saveJSON = saveJSON;
