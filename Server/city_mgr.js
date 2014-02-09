
// 代表一个city，类似于线的功能
// 在一个city里面，主城里面大家可以看见对方。
function City() {
	this.mUserInfos = {};
	this.mPlayerNum = 0;
	
	this.GetPlayerNum = function() { return this.mPlayerNum; }
	this.IsFull = function() { return this.mPlayerNum >= global.MAX_NUM_PER_CITY; }
	
	this.Foreach = function(callback) {
		for (var i in this.mUserInfos)
			callback(this.mUserInfos[i].user);
	}
	
	// 激活&非激活
	this.Active = function(user, active) {
		var key = user.Key();
		var info = this.mUserInfos[key];
		if (info === undefined) {
			console.log("用户不在场景里面。");
			return false;
		}
		
		// 状态相同则不做处理。
		if (info.active === active)
			return;
			
		info.active = active;
		if (info.active) {
			// 通知其他玩家，进来了。
			var data = this.GetCityUserInfo(info);
			this.Broadcast(user, data, "CityPlayerInfo", global.USER_ENTER_CITY);
		}
		else {
			this.Broadcast(user, key, undefined, global.USER_LEAVE_CITY);
		}
	}
	
	// 玩家进入城市场景。
	this.Enter = function(user) {
		var key = user.Key();
		var info = this.mUserInfos[key];
		if (info !== undefined)
			return false;
		
		// 创建一个新的info来存储。
		this.mUserInfos[key] = {
			user: user,
			active: false,
			pos: {x: 0, y: 0, z: 0 },
		};
		
		this.mPlayerNum++;
		return true;
	}
	
	// 玩家离开城市场景。
	this.Leave = function(user) {
		var key = user.Key();
		var info = this.mUserInfos[key];
		if (info === undefined) {
			console.log("用户不存在城市场景！！");
			return false;
		}
		
		// 删除该用户。
		delete this.mUserInfos[key];
		
		this.mPlayerNum--;
		return true;
	}
	
	// 玩家在主城里面移动，发送坐标点过来
	// 服务器将广播给其他的玩家。
	this.Move = function(user, x, y, z) {
		var key = user.Key();
		var info = this.mUserInfos[key];
		if (info === undefined) {
			console.log("用户不存在城市场景！！");
			return false;
		}
		
		if (!info.active)
			return;
			
		info.pos.x = x;
		info.pos.y = y;
		info.pos.z = z;
		var data = {
			user: key,
			pos: info.pos,
		}
		this.Broadcast(user, data, "MoveInfo", global.USER_MOVE_IN_CITY);
	}

	// 获取单个用户的信息。
	this.GetCityUserInfo = function(info) {
		var item = {
			data: {},
			pos: info.pos,
		};
		info.user.Fill(item.data, true, true); // onlyInfo, onlyEquip
		return item;
	}

	// 获取到场景里面活动的玩家.
	this.GetActiveUsers = function(user) {
		var ret = { users: [] };
		for (var i in this.mUserInfos) {
			var info = this.mUserInfos[i];
			if (info.active && info.user !== user) {
				var data = this.GetCityUserInfo(info);
				ret.users.push(data);
			}
		}
		return ret;
	}
	
	// 广播给其他人吧。
	this.Broadcast = function(exceptUser, data, schema, id) {
		var buff = global.CommandManager.Build(undefined, data, schema, id);
		for (var key in this.mUserInfos) {
			var info = this.mUserInfos[key];
			if (info !== undefined && info.active && info.user !== exceptUser)
				info.user.SendBuff(buff);
		};
	}
}

//
// CityManager
//
if (global.CityManager == null) global.CityManager = new function() {
	this.mCitys = []; // 所有的城市场景。
	this.mFreeCitys = []; // 所有的有空位的城市场景。
	
	this.GetCityNum = function() { return this.mCitys.length; }
	this.GetCity = function(idx) { return this.mCitys[idx]; }
	
	this.CreateCity = function() {
		var city = new City();
		this.mCitys.push(city);
		global.Status.CityNum = this.mCitys.length;
		return city;
	}
	
	// 玩家进入城市场景。
	this.Enter = function(user) {
		// 已经在city里面的话，激活一下。
		if (user.city === undefined) {
			// 获取一个有空位的城市场景。
			if (this.mFreeCitys.length == 0) {
				console.LOG("没有足够的空闲城市场景，申请创建一个新的。");
				var city = this.CreateCity();
				this.mFreeCitys.push(city);
			}
			var city = this.mFreeCitys[this.mFreeCitys.length - 1];
			
			// 添加这个玩家之后，若该场景已满，则从空闲列表中移除。
			if (city.IsFull())
				this.mFreeCitys.pop();

			// 添加到该城市。
			city.Enter(user);
			user.city = city;
		}
		
		// 激活此玩家。
		user.city.Active(user, true);
	}
	
	// 玩家离开城市场景。
	// 如果是离线，则offline为ture，腾出空位，否则依然占有城市位置。
	this.Leave = function(user, offline) {
		if (user.city === undefined) {
			console.LOG("玩家还不在城市里面, 可能是副本里面直接掉线了。");
			return;
		}
		
		// 非激活此玩家。
		user.city.Active(user, false);
		
		// 用户离线，视为强制离开
		// 当然这里要处理中途断线的情况。
		if (offline) {
			var city = user.city;
			city.Leave(user);
			delete user.city;
			
			// 添加到空闲城市场景里面去。
			if (!city.IsFull() && this.mFreeCitys.indexOf(city) === -1)
				this.mFreeCitys.push(city);
		}
	}
	
	// 遍历所有的城市~
	this.Foreach = function(callback) {
		for (var i in this.mCitys)
			callback(this.mCitys[i]);
	}
	
	// 这里是异步发送数据。采用了process.nextTick的设计。
	// 也就是每帧调用一个城市里面所有的玩家，避免一次工作太多导致程序卡住。
	this.AsyncForeach = function(callback) {
		var cityIdx = -1;
		var self = this;
		var cityCheck = function() {
			if (++cityIdx < self.mCitys.length) {
				var city = self.mCitys[cityIdx];
				city.Foreach(callback);
				// 安排到下一帧去处理逻辑。
				process.nextTick(cityCheck);
			}
		};
		cityCheck();
	}
}


// 批量获取城市场景里面玩家的信息。
exports.GetCityActiveUsers = function(service, url, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
	
	// 强制加入到城市场景里面。
	if (user.city === undefined)
		global.CityManager.Enter(user);
	
	var ret = user.city.GetActiveUsers(user);
	response.Send(ret, "CityUsers");
}

// 在场景里面移动.
exports.MoveInCity = function(service, MoveCmd, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
	
	// 强制加入到城市场景里面。
	if (user.city === undefined)
		global.CityManager.Enter(user);

	var x = MoveCmd.x || 0;
	var y = MoveCmd.y || 0;
	var z = MoveCmd.z || 0;
	user.city.Move(user, x, y, z);
	response.Done(); // 交还给内存池。
}
