/* Base plugin for TwitchBot
 * @author: Albert ten Napel
 * @version: 0.1
 *
 * Contains a few useful commands for mods.
 *
 * 	Options: {
 *		ask: a list of possible results of the ask command
 * 	}
 *
 * 	Free commands:
 * 		ask [question]: returns a random string from a list 
 * 		commands/help: shows the commands
 *
 *	Mod commands:
 *		say [message]: Makes the bot say something
 *		addcommand [name] [message]: Adds a simple mod-only command that returns a message when called
 *		addfreecommand [name] [message]: Like addcommand but anyone will be able to use the command
 *		removecommand [name]: Removes a command
 *		do/js [code]: Executes a javascript expression, 'this' is the bot.
 */
function(bot, twitchbot) {
	var config = bot.config.base || {};
	var ASK = config.ask || ['Yes', 'No', 'Maybe'];

	bot.addCommands(
		'say', function(o) {this.say(o.rest)},
		'@ask', function(o) {
			return ASK[0|ASK.length*Math.random()];
		},
		['@commands', '@help'], function() {
			return 'The commands are: ' + this.getFreeCommands().join(', ');
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
}
