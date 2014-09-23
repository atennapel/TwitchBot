/* Betting plugin for TwitchBot
 * @author: Albert ten Napel
 * @version: 0.2
 *
 * Adds a betting system to the bot. Mods can open bets and users can bet coins on certain outcomes.
 *
 * 	Options: {
 *		coinName: name of the coin,
 *		limit: the time (in milliseconds) a player has to wait before he can bet again,
 *	}
 *
 *	Free commands:
 *		bet [coins] [outcome]: bet [coins] amount of coins on the outcome [outcom], [outcome] must be one of the data types below (only one allowed).
 *		currentbet: get the current bet description
 *		pot: current amount of coins in the pot
 *
 *	Mod commands:
 *		openbet [decription]: Allow users to start betting (clears all the bets)
 *		reopenbet: Allow users to start betting again (doesn't clear the bets)
 *		closebet: Stop users from being able to bet
 *		endbet [outcome]: Give the bet result, [outcome] can be one of the data types below. 
 *
 * 	Data types:
 * 		The bet outcomes needs to be a specific outcome, it must be one of these:
 * 		- Number (10, 0, 0.4, 234.3)
 * 		- Time (12h6m9s100u)
 * 		- Word (word, word2, this_is_also_a_word)
 */
function(bot, twitchbot) {
	var config = bot.config.bet || {};

	var COINNAME = config.coinName || 'coin(s)';
	var LIMIT = typeof config.limit == 'number'? config.limit: 100;
	
	var bets = [];
	var betsopen = false;
	var betdescription = '';
	var pot = 0;

	var checkPlayer = function(player) {
		return bot.getData(player, {
			coins: 100,
			betwins: 0,
			betgames: 0,
			betcoinsspent: 0,
			betcoinswon: 0,
			betlimit: 0
		});
	};

	function getOutcome(x) {
		if(typeof x == 'number')
			return {type: 'number', val: x};
		var x = x.trim(), n = +x;
		if(/^([0-9]+[hmsu])+$/i.test(x)) {
			var o = {h: 0, m: 0, s: 0, u: 0};
			var a = x.match(/[0-9]+[hmsu]/g);
			for(var i = 0, l = a.length; i < l; i++) {
				var c = a[i], n = +c.slice(0, -1), t = c[c.length-1];
				o[t] = n;
			}
			var d = 0;
			d += o.u;
			d += o.s * 1000;
			d += o.m * 1000 * 60;
			d += o.h * 1000 * 60 * 60;
			return {type: 'time', val: +d};
		} if(!isNaN(n)) { return {type: 'number', val: n};
		} else if(/^[^\s]+$/.test(x)) return {type: 'word', val: x};
		else return null;
	}

	bot.addCommand('openbet', function(o) {bets = []; betsopen = true; betdescription = o.rest; pot = 0; return 'Bets opened!'});
	bot.addCommand('reopenbet', function() {betsopen = true; return 'Bets reopened!'});
	bot.addCommand('closebet', function() {if(betsopen) {betsopen = false; return 'Bets closed!'}});
	bot.addCommand('@currentbet', function() {return betdescription || 'No bet description'});
	bot.addCommand('@pot', function() {return 'Current pot: ' + pot});

	bot.addCommand('endbet', function(o) {
		if(bets.length == 0) return 'No bets were made.';

		var outcome_s = o.rest.trim('').split(/\s+/g)[0];
		var outcome = getOutcome(outcome_s);
		var val = outcome.val;
		var t = outcome.type;

		var winners = [];
		if(t == 'word') {
			for(var i = 0, l = bets.length; i < l; i++) {
				var c = bets[i];
				if(t == c.outcome.type && c.outcome.val == val)
					winners.push(c.player);
			}
		} else {
			var pos = [];
			for(var i = 0, l = bets.length; i < l; i++) {
				var c = bets[i];
				if(t == c.outcome.type)
					pos.push({player: c.player, val: c.outcome.val});
			}
			pos = pos.sort(function(x, y) {
				return x.val - y.val;
			});
			var f = pos[0].val;
			for(var i = 0, l = pos.length; i < l; i++) {
				if(f == pos[i].val) {
					winners.push(pos[i].player);
				}
			}
		}

		var amount = 0|pot/winners.length;
		for(var i = 0, l = winners.length; i < l; i++) {
			var winner = winners[i];
			var data = checkPlayer(winner);
			data.coins += amount;
			data.betwins++;
			data.betcoinswon += amount;
		}

		bets = [];
		betsopen = false;
		betdescription = '';
		pot = 0;

		return 'Bet ended! ' + winners.join(', ') + ' won ' + amount + '!';
	});

	bot.addCommand('@bet', function(o) {
		if(!betsopen) return;

		var player = o.from;
		var data = checkPlayer(player);
		var amount = +o.args[0];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0)
			return player + ': Use the command like: !bet [amount to gamble, positive number] [outcome]';

		var time = data.betlimit;
		var now = Date.now();
		if(now - time < LIMIT)
			return player + ': You have to wait ' + (0|(LIMIT - (now - time))/1000) + ' more seconds before you can play again.';
		data.betlimit = now;

		var playerAmount = data.coins;
		if(playerAmount <= 0 || playerAmount < amount) return player + ": You don't have enough " + COINNAME + ".";
		
		var outcome_s = o.args[1];
		var outcome = getOutcome(outcome_s);
		if(!outcome) return player + ': Invalid outcome';

		pot += amount;
		data.coins -= amount;
		data.betcoinsspent += amount;
		data.betgames++;
		
		bets.push({player: player, outcome: outcome});
		return player + ': You bet ' + amount + ' on ' + outcome_s;
	});
}
