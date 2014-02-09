
var PvpHall = require('./base/pvp_hall').PvpHall;

// pvp的管理器。
if (global.PvpManager === undefined) global.PvpManager = new function() {
	var mHalls = {
		0: new PvpHall(0, 2, 10000),
	};
	
	// 加入指定的PVP房间。
	this.Join = function(user, id) {
		var room = mHalls[id];
		if (room === undefined)
			return "PvpHallNotFound";
			
		// 如果之前在pvp房间里面，则从里面离开。
		if (user.PvpRoom !== undefined) {
			user.PvpRoom.Leave(user);
			delete user.PvpRoom;
		}
	
		// 如果之前有大厅，则从里面离开，加入新的房间。
		if (user.PvpHall !== undefined)
			user.PvpHall.Leave(user);
			
		// 绑定PVP房间。
		if (room.Join(user) === undefined)
			user.PvpHall = room;
	}
	
	// 离开pvp房间。
	this.Leave = function(user) {
		if (user.PvpHall !== undefined) {
			user.PvpHall.Leave(user);
			delete user.PvpHall;
		}
	}
	
	// pvp完成结果～
	this.Finish = function(user, result, callback) {
		if (user.PvpRoom === undefined)
			return callback("UserNotInPvp");
		var data = user.PvpRoom.CheckFinish(user, result);
		delete user.PvpRoom;
		callback(undefined, data);
	}
	
	// 玩家离线了。
	this.Offline = function(user) {
		// 从大厅离开。
		if (user.PvpHall !== undefined) {
			user.PvpHall.Leave(user);
			delete user.PvpHall;
		}
		
		// 从pvp房间里面离开。
		if (user.PvpRoom !== undefined) {
			user.PvpRoom.Leave(user);
			delete user.PvpRoom;
		}
	}
	
	this.Tick = function() {
		for (var i in mHalls)
			mHalls[i].Tick(1);
	}
	
	// 每1秒钟刷新一次PVP的轮数。
	setInterval(this.Tick, global.PVP_ROUND_TIME);
}

// 加入pvp大厅里面，排队进入服务器配对。
exports.JoinPvp = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
	
	if (!global.SWITCHES.PVP)
		return response.Error("PvpDisabled");
		
	var id = 0;//(params.id || 0);
	var err = global.PvpManager.Join(user, id);
	if (err)
		response.Error(err);
	else
		response.Send("JoinSuccess");
}

// 退出配对的队伍。
exports.LeavePvp = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.PVP)
		return response.Error("PvpDisabled");
		
	var err = global.PvpManager.Leave(user);
	if (err)
		response.Error(err);
	else
		response.Send("LeaveSuccess");
}

// 完成pvp～
exports.FinishPvp = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.PVP)
		return response.Error("PvpDisabled");
		
	global.PvpManager.Finish(user, params.result, function(err, data) {
		if (err)
			response.Error(err);
		else
			response.Send(data, "PvpFinish");
	});
}

// 获取pvp的信息
exports.GetPvpInfo = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
	
	if (!global.SWITCHES.PVP)
		return response.Error("PvpDisabled");
		
	var pvpInfo = user.PvpInfo;
	pvpInfo.PvpLevel = user.Attrib.PvpLevel;
	pvpInfo.PvpExp = user.Attrib.PvpExp;
	response.Send(pvpInfo, "PvpInfo");
}
