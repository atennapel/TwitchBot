/* Labbebot-srl
 * This is the chatbot used in #deusex at the SRL IRC.
 * @author: Albert ten Napel (Labbekak)
 */
var bot = require('./twitchbot').create('config.json');
bot.alwaysMod('labbekak');
bot.logger.startServer(process.env.OPENSHIFT_NODEJS_PORT || 80,
											 process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1');
