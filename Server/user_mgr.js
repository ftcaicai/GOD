
var User = require('./user').User;

if (global.UserManager == undefined) global.UserManager = new function() {
	this.mUsers = {};
	this.mOfflineUser = {};
	this.mUserNum = 0;
	
	this.GetUserNum = function() { return this.mUserNum; }
	
	// 用户登录。
	this.UserLogin = function(dbUser) {
		var user = new User(dbUser);
		return user;
	}
	
	// 用户重新登录。
	this.UserRelogin = function(connection, id, key, callback) {
		this.EnterGame(connection, id, key, callback);
	}

	// 对外的接口。
	// 让其他可以遍历，如聊天里面的广播。
	this.Foreach = function(callback, force) {
		// 强制一次性发送给所有玩家。
		if (force) {
			for (var i in this.mUsers) callback(this.mUsers[i]);
			return;
		}
		// 默认按城市场景发送，避免一次发送过多数据。
		global.CityManager.AsyncForeach(callback);
	}

	// 玩家上线，添加到列表。
	this.Online = function(user) {
		var key = user.Key();
		if (this.mUsers[key] !== undefined) {
			console.warn('User already online: ' + key);
		}

		// 人数统计。
		this.mUserNum++;
		global.Status.UserNum = this.mUserNum;
		if (this.mUserNum > (global.Status.MaxUserNum || 0))
			global.Status.MaxUserNum = this.mUserNum;
		
		// 获取玩家登录的IP地址。
		var remoteAddress = user.connection.remoteAddress;
		if (!remoteAddress && user.connection._socket)
			remoteAddress = user.connection._socket.remoteAddress;
			
		console.LOG("玩家上线: 玩家[%s] IP[%s] 在线人数[%d]",
			key,
			remoteAddress,
			this.mUserNum);

		// 记录一下玩家最后一次登录的时间和ip地址
		// 以后需要用来计算留存神马的。
		var now = new Date();
		if (user.LoginInfo.LastLoginTime === undefined ||
			user.LoginInfo.LastLoginTime.getMonth() !== now.getMonth() ||
			user.LoginInfo.LastLoginTime.getDate() !== now.getDate()) {
			// 第一次登陆需要更新属性。
			if (user.LoginInfo.LastLoginTime === undefined)
				user.UpdateAttrib();
				
			// 当天的登录需要记录。当然细节的登录去查log日志吧
			// 这里主要是方便GM工具来统计留存的。
			global.RecordManager.Login(user, now);
		}
		user.LoginInfo.LastLoginTime = now;
		user.LoginInfo.LastLoginIp = remoteAddress;
		user.Dirty("LoginInfo");

		// 将玩家添加到队列中去。
		this.mUsers[key] = user;
		
		// 检测一下离线玩家，踢出去。
		if (this.mOfflineUser[key] !== undefined)
			delete this.mOfflineUser[key];
	}
	
	// 玩家下线，从列表中移除。
	this.Offline = function(user) {
		var key = user.Key();
		if (this.mUsers[key] === undefined) {
			console.error('User already offline: ' + key);
			return;
		}
		
		// 人数统计
		this.mUserNum--;
		global.Status.UserNum = this.mUserNum;
		
		console.LOG("玩家下线: 玩家[%s] 在线人数[%d]", 
			key,
			this.mUserNum);

		// 从队列中删除该玩家。
		delete this.mUsers[key];
		
		// 添加到离线玩家列表内。
		this.mOfflineUser[key] = user;
	
		// 测试系统公告
		//global.ChatManager.Broadcast(global.TEXTS.GM_USER_OFFLINE + key);
	}
	
	// 查找玩家。
	this.Find = function(key, offline) {
		var ret = this.mUsers[key];
		if (ret === undefined && offline)
			ret = this.mOfflineUser[key];
		return ret;
	}
	
	// 获取到玩家的数据。
	this.GetUserData = function(key, all_attrib, callback) {
		// 先查找一下是不是在线内容。
		var user = this.mUsers[key];
		if (user === undefined) user = this.mOfflineUser[key];
		if (user !== undefined) {
			var data = {};
			user.Fill(data, !all_attrib, true);
			return callback(undefined, data);
		}
		
		// 在线玩家没有找到的话，从数据库里面读取。
		global.Service.Database.collection(global.TABLES.USER, function(err, collection) {
			if (err || collection === undefined)
				return callback('DatabaseError');
				
			collection.findOne({user: key}, {Attrib:true, Packages:true}, function(err, item) {
				if (item == null)
					return callback('UserNotFound');
					
				var data = {
					Attrib: item.Attrib,
					Packages: {
						BackPack: { Items: {} },
					},
				};
				if (!all_attrib) data.Attrib = {
					Name: item.Attrib.Name,
					Role: item.Attrib.Role,
					Level: item.Attrib.Level,
					PvpLevel: item.Attrib.PvpLevel, // pvp的等级～
				};
				
				var srcItems = item.Packages.BackPack.Items;
				var desItems = data.Packages.BackPack.Items;
				for (var i in srcItems) {
					var srcItem = srcItems[i];
					if (srcItem.Attrib.Equip)
						desItems[i] = srcItem;
				}
				callback(err, data);
			});
		});
	}
	
	// 加入游戏～～～
	this.EnterGameInternal = function(connection, user, callback) {
		// 将玩家链接起来。
		user.connection = connection;
		connection.user = user;
		
		// 掉线的时候
		connection.once('close', function() {
			if (connection.user != null)
				global.UserManager.LeaveGame(connection.user);
		});
		
		// 开启在线模式。
		user.Online();

		callback(undefined, user);

		console.LOG("进入游戏: 玩家[%s]", 
			user.Key());
	}

	// 请求进入游戏
	this.EnterGame = function(connection, id, key, callback) {
		// 已经在游戏里面了。
		if (this.mUsers[key] !== undefined)
			return callback('UserAlreadyInGame');
		
		// 尝试从离线玩家列表中加载。
		if (this.mOfflineUser[key] !== undefined)
			return this.EnterGameInternal(connection, this.mOfflineUser[key], callback);
		
		// 看样子非得查询数据库了。
		global.RecordManager.findOne(global.TABLES.USER, {id: id, user: key}, function(err, item) {
			if (err || item == null)
				return callback('UserNotFound');
				
			var user = global.UserManager.UserLogin(item);
			global.UserManager.EnterGameInternal(connection, user, callback);
		});
	}
	
	// 角色离开游戏。
	this.LeaveGame = function(user, callback) {
		user.Offline();
		
		// 离开游戏的时候，解除玩家和网络的绑定关系。
		if (user.connection != null) {
			delete user.connection.user;
			delete user.connection;
		}
		
		if (callback)
			callback(undefined, "LeaveGameSuccess");
			
		console.LOG("离开游戏: 玩家[%s]", user.Key());
	}
	
	// 批量保存。注意：这里有可能是由定时器调用的
	// this指针不能用在下面作用域。
	this.Save = function(key) {
		// 保存所有的玩家。这里的话是通过CityManager来按照每个city来执行。
		// 为了一次不要循环太多的user而导致程序卡住设计的。
		global.CityManager.AsyncForeach(function(user){
			user.Save();
		});
	}

	// 服务器关闭的时候调用的
	this.OnExit = function() {
		this.Save();
	}
	
	// 每5分钟保存一次玩家到数据库
	//setInterval(this.Save, global.USER_SAVE_TIME);
};

// 获取到玩家的基本信息。
exports.GetUserAttrib = function(service, params, connection,  response) {
	if (connection.user === undefined)
		return response.Error("UserNotLogin");
		
	var user = connection.user;
	response.Send(user.Attrib, "MainAttrib");
}

// 获取指定玩家的信息。
exports.GetUserData = function(service, params, connection,  response) {
	var userKey = params.user;
	global.UserManager.GetUserData(userKey, params.all_attrib === true, function(err, item) {
		if (err)
			response.Error(err);
		else
			response.Send(item, "PlayerData");
	});
}

// 获取玩家的体力。
exports.GetUserStrength = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	var strengthInfo = {
		value: user.GetStrength(),
		time: (user.Strength.buy_count || 0) };
	if (strengthInfo.time > 0) {
		var now = new Date();
		// 若不是当天的次数，则重置为0.
		if (user.Strength.buy_time !== undefined && 
			user.Strength.buy_time.toDateString() != now.toDateString()) {
			user.Strength.buy_time = undefined;
			strengthInfo.time = user.Strength.buy_count = 0;
		}
	}
	response.Send(strengthInfo, "StrengthInfo");
}

// 购买满体力。
exports.BuyUserStrength = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
	
	var now = new Date();
	var buyTime = user.Strength.buy_time;
	var buyCount = (user.Strength.buy_count || 0) + 1;
	
	// 若不是同一天，则重置购买次数。
	if (buyCount !== 1 &&
		buyTime !== undefined && 
		buyTime.toDateString() != now.toDateString())
		buyCount = 1;
	
	// 读取表格。
	var strengthBase = global.StrengthBaseTable.GetItem(buyCount);
	if (strengthBase === undefined)
		return response.Error("CanotBuyStrength");
	
	if (user.Attrib.Gem < strengthBase.Gem)
		return response.Error("NotEnoughGem");
	
	// 扣除钻石。
	user.AddGem(-strengthBase.Gem);

	// 记录数据和时间。
	user.Strength.buy_count = buyCount;
	user.Strength.buy_time = now;
	
	// 增加体力值。
	user.AddStrength(strengthBase.Recover);

	response.Send("BuyStrengthSuccess");
}

// 玩家请求进入游戏
exports.EnterGame = function(service, params, connection,  response) {
	if (connection.account === undefined)
		return response.Error("AccountNotLogin");
		
	if (connection.user !== undefined)
		return response.Error("UserInGame");
	
	var name = params.user;
	if (name === undefined)
		return response.Error("InvalidParam");
		
	global.UserManager.EnterGame(connection, connection.account, name, function(err, user) {
		if (err) return response.Error(err);
		
		// 返回数据。
		var data = {};
		user.Fill(data);
		response.Send(data, "PlayerData");
	});
}

// 玩家请求离开游戏。
exports.LeaveGame = function(service, params, connection, response) {
	if (connection.account === undefined)
		return response.Error("AccountNotLogin");
		
	if (connection.user === undefined)
		return response.Error("UserNotInGame");
		
	global.UserManager.LeaveGame(connection.user, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}
