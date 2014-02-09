
var PvpRoom = require('./pvp_room').PvpRoom;
var HttpHelp = require('./http_help');
var URL = require('url');

// pvp的大厅模式。
function PvpHall(id, num, base) {
	var mUsers = {}; // 大厅里面所有的玩家（排队等待的。）
	
	this.Key = function() { return id; }
	
	// 加入PVP战斗。
	this.Join = function(user) {
		var key = user.Key();
		
		// 已经在排队了。
		if (mUsers[key] !== undefined) 
			return "AlreadyJoined"; 
		
		// 加入队列。等待服务器的刷新来创建房间。
		mUsers[key] = { user: user, level: (user.Attrib.PvpLevel || 1), range: 0 };
	}
	
	// 离开PVP战斗
	this.Leave = function(user) {
		var key = user.Key();
		
		// 没有在大厅里面排队。
		if (mUsers[key] === undefined) 
			return "NotJoined"; 
			
		delete mUsers[key];
	}
	
	// 判断大厅里面的2个人是否匹配
	this.Match = function(self, target) {
		var diff = Math.abs(self.level - target.level);
		return (diff <= self.range || diff <= target.range);
	}
	
	// 匹配一个队伍出来。
	this.MatchTeam = function(item) {
		var team = [item];
		for (var i in mUsers) {
			var target = mUsers[i];
			if (target == item || target.done) 
				continue;
			
			if (this.Match(item, target))
				team.push(target);
				
			if (team.length >= num)
				break;
		}
		
		if (team.length >= num) {
			// 标记为已经匹配上了。
			for (var i in team)
				team[i].done = true;
			return team;
		}
	}
	
	// 轮数开始计算。
	this.Tick = function(step) {
		var teams = [];
		for (var i in mUsers) {
			var item = mUsers[i];
			item.range += step;
			var team = this.MatchTeam(item);
			if (team !== undefined)
				teams.push(team);
		}
		
		// 开始组建pvp的房间。
		var self = this;
		teams.forEach(function(team) {
			// 获取所有pvp里面的房间user
			// 将这些user都踢出大厅。
			var teamUsers = [];
			for (var i in team) {
				self.Leave(team[i].user);
				teamUsers.push(team[i].user);
			}
			
			// 逻辑丢到PvpRoom里面去处理。
			var room = new PvpRoom(self, teamUsers);
			
			// 检查Pvp服务器。获取id号！！！
			var server = global.Service.Config.PVP.Server[0];
			var map = global.Service.Config.PVP.Map[0];
			var options = URL.parse(server);
			options.protocol = 'http:';
			options.path = '/alloc_id';
			HttpHelp.HttpGet(options, function(err, res) {
				if (err) 
					return console.ERROR('Pvp alloc_id failed: ' + err + ' at: ' + JSON.stringify(options));
					
				console.log("http get response:" + res);
				var ret = JSON.parse(res);
				if (ret == null || isNaN(ret.data))
					return console.ERROR('Pvp alloc_id invalid response: ' + res);
					
				room.Init(server, map, ret.data);
			});
		});
	}
}

exports.PvpHall = PvpHall;
