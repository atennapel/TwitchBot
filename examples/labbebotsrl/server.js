/* Labbebot-srl
 * This is the chatbot used in #deusex at the SRL IRC.
 * @author: Albert ten Napel (Labbekak)
 */
function pick(a) {return a[0|a.length*Math.random()]}

var bot = new require('./twitchbot').create('config.json');
bot.addCommands(
	'say', function(o) {this.say(o.rest)},

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

bot.alwaysMod('labbekak');

bot.addVars(
	['user', 'randuser'], function() {return pick(this.users())}
);

bot.logger.startServer(process.env.OPENSHIFT_NODEJS_PORT || 80,
											 process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1');
