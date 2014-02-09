
var PackageManager = require('./package_mgr').PackageManager;

function User(dbItem) {
	this.DbItem = dbItem;
	this.Attrib = dbItem.Attrib;
	this.LevelInfos = dbItem.LevelInfos;
	this.Mails = dbItem.Mails;
	this.LoginInfo = dbItem.LoginInfo;
	this.Friends = dbItem.Friends;
	this.Quests = dbItem.Quests;
	this.Strength = dbItem.Strength;
	this.PvpInfo = dbItem.PvpInfo;
	this.ReviveInfo = dbItem.ReviveInfo;
	this.PackageManager = new PackageManager(this);
	this.IsDirty = false;
	this.IsOnline = false;
	
	// 老帐号的问题。
	if (dbItem.Friends === undefined) dbItem.Friends = this.Friends = {};
	if (dbItem.Quests === undefined) dbItem.Quests = this.Quests = {};
	if (dbItem.Strength === undefined) dbItem.Strength = this.Strength = {};
	if (dbItem.PvpInfo === undefined) dbItem.PvpInfo = this.PvpInfo = {};
	if (dbItem.ReviveInfo === undefined) dbItem.ReviveInfo = this.ReviveInfo = {};

	this.Load();
}

User.prototype.Key = function() {
	return this.Attrib.Name;
}

// 定时保存数据～
User.prototype.handleSaveTimer = function() {
	if (this.IsDirty) this.Save();
	this._saveTimeoutID = setTimeout(this._saveTimerHandler, global.USER_SAVE_TIME);
}

// 开启/关闭定时任务。
User.prototype.setSaveTimer = function(start) {
	// 清楚之前的_saveTimeoutID
	if (this._saveTimeoutID)
		clearTimeout(this._saveTimeoutID);
	this._saveTimeoutID = null;

	// 定时保存数据的接口～	
	if (start) {
		if (!this._saveTimerHandler)
			this._saveTimerHandler = this.handleSaveTimer.bind(this);
			
		this._saveTimeoutID = setTimeout(this._saveTimerHandler, global.USER_SAVE_TIME);
	}
};

User.prototype.FetchPlayerAttrib = function() {
	var role = this.Attrib.Role;
	var level = this.Attrib.Level;
	return global.PlayerAttribTable.GetItem(role, level);
}

User.prototype.Load = function() {
	this.Attrib = this.DbItem.Attrib;
	this.LevelInfos = this.DbItem.LevelInfos;
	
	// init the [PlayerAttrib]
	this.PlayerAttrib = this.FetchPlayerAttrib();
	
	this.PackageManager.Load(this.DbItem.Packages);
}

User.prototype.Save = function() {
	if (!this.IsDirty) 
		return;
	
	var user = this;
	global.Service.Database.collection(global.TABLES.USER, function(err, collection) {
		if (collection == null) {
			console.error("Database error while doint user saving... " + err);
			return;
		}
		
		// 先标记为已经保存到数据库里面去了。
		// 然后发送数据到数据库里面去。
		user.ClearDirty();
		collection.save(user.DbItem, function(err, doc) {
			// 如果保存出错误，标记回来。
			if (err) user.Dirty(true);
		});
	});
}

User.prototype.Fill = function(data, onlyInfo, onlyEquip) {
	// the main attribute of the user.
	if (onlyInfo) {
		data.Attrib = {
			Name: this.Attrib.Name,
			Role: this.Attrib.Role,
			Level: this.Attrib.Level,
			MoveSpeed: this.Attrib.MoveSpeed, // 玩家的移动速度
			PvpLevel: this.Attrib.PvpLevel, // pvp的等级～
		};
	}
	else
		data.Attrib = this.Attrib;
	this.PackageManager.Fill(data, onlyEquip);
}

// 发送数据给客户端。
User.prototype.SendBuff = function(buff) {
	if (this.connection === undefined)
		return console.ERROR("网络连接都木有，不能发送信息。");
		
	this.connection.sendBytes(buff);
}

// 发送指定的消息给客户端。
User.prototype.Send = function(data, schema, id) {
	var buff = global.CommandManager.Build(undefined, data, schema, id);
	this.SendBuff(buff);
}

// 玩家上线
User.prototype.Online = function(relogin) {
	this.IsOnline = true;
	// 默认加入城市场景。
	if (!relogin || this.levelData === undefined)
		global.CityManager.Enter(this);
	// 告诉【UserManager】
	global.UserManager.Online(this);
	// 设置定时保存数据定时器。
	this.setSaveTimer(true);
}

// 玩家下线
User.prototype.Offline = function(force) {
	// 强制离开城市场景。
	global.CityManager.Leave(this, true);
	// 告诉【UserManager】
	global.UserManager.Offline(this);
	// 告诉【PvpManager】
	global.PvpManager.Offline(this);
	// 记录一下在线时间。
	this.LoginInfo.OnlineTime = (this.LoginInfo.OnlineTime || 0) + (new Date() - this.LoginInfo.LastLoginTime);
	// 下线的时候，强制保存一下玩家数据。
	this.Save();
	// 清除定时保存数据定时器。
	this.setSaveTimer(false);
	
	// 设置标志。
	this.IsOnline = false;
}

User.prototype.ClearDirty = function() {
	this.IsDirty = false;
}

User.prototype.Dirty = function(flag) {
	this.IsDirty = true;
}

User.prototype.UpdateAttrib = function() {
	var attrib = this.FetchPlayerAttrib();
	if (attrib === undefined) return false;
	
	// 更新属性表格。
	this.PlayerAttrib = attrib;
		
	// 角色的基础属性值。
	for (var i in attrib)
		this.Attrib[i] = attrib[i];
	
	this.PackageManager.UpdateAttrib();

	// 计算一下战力。
	this.Attrib.Battle = 0;
	var battleBases = global.BattleBaseTable.GetAllItem();
	for (var i in battleBases) {
		var attrib = this.Attrib[i];
		var weight = battleBases[i].Weight;
		this.Attrib.Battle += attrib * weight;
	}
	return true;
}

// 升级了
User.prototype.Upgrade = function() {
	var oldLevel = this.Attrib.Level;
	this.Attrib.Level++;
	if (!this.UpdateAttrib()) {
		// 重置回原来的等级。
		this.Attrib.Level--;
		return false;
	}
		
	this.Dirty("Attrib");

	console.LOG("玩家升级: 玩家[%s] 等级[%d]",
		this.Key(),
		this.Attrib.Level);
		
	return true;
}

// 增加或者扣除金币。
User.prototype.AddGold = function(gold) {
	this.Attrib.Gold += gold;
	if (gold < 0)
		this.Attrib.CostGold += (-gold);
	this.Attrib.TotalGold = this.Attrib.Gold + this.Attrib.CostGold;
	this.Dirty("Attrib");
	
	// 服务器开始记录相应的产值。
	if (gold > 0) global.Status.GoldProduce = (global.Status.GoldProduce || 0) + gold;
	else global.Status.GoldCost = (global.Status.GoldCost || 0) + (-gold);
}

// 增加或者扣除钻石
User.prototype.AddGem = function(gem) {
	this.Attrib.Gem += gem;
	if (gem < 0)
		this.Attrib.CostGem += (-gem);
	this.Attrib.TotalGem = this.Attrib.Gem + this.Attrib.CostGem;
	this.Dirty("Attrib");
	
	// 服务器开始记录相应的产值。
	if (gem > 0) global.Status.GemProduce = (global.Status.GemProduce || 0) + gem;
	else global.Status.GemCost = (global.Status.GemCost || 0) + (-gem);
}

// 给玩家增加经验。
User.prototype.AddExp = function(exp) {
	// check update the level.
	this.Attrib.CurExp += exp;
	this.Dirty("Attrib");
	
	// handle the level up.
	while (this.PlayerAttrib !== undefined && this.Attrib.CurExp >= this.PlayerAttrib.NextExp) {
		this.Attrib.CurExp -= this.PlayerAttrib.NextExp;
		if (!this.Upgrade()) {
			// 满级的话，经验不会涨了。一直维持着满满的状态～～～
			this.Attrib.CurExp = this.PlayerAttrib.NextExp;
			break;
		}
	}
}

// 给玩家增加SP点。
User.prototype.AddSP = function(sp) {
	this.Attrib.SP += sp;
	this.Dirty("Attrib");
}

// 增加pvp经验，调整pvp等级。
// 注意：pvp等级是可以降级的。
User.prototype.AddPvpExp = function(exp) {
	var pvpExp = Math.max(0, (this.Attrib.PvpExp || 0) + exp);
	var pvpLevel = this.Attrib.PvpLevel || 1;
	var pvpBase = global.PvpBaseTable.GetItem(pvpLevel);
	if (pvpBase !== undefined) {
		if (pvpLevel < global.PVP_MAX_LEVEL && pvpBase.Exp < pvpExp)
			pvpLevel++;
		else if (pvpLevel > 1 && pvpExp < pvpBase.Exp - pvpBase.NextExp)
			pvpLevel--;
	}
	
	this.Attrib.PvpExp = pvpExp;
	this.Attrib.PvpLevel = pvpLevel;
	this.Dirty("Attrib");
}

// 获取玩家的体力。
User.prototype.GetStrength = function() {
	// 若时间没有设置，说明体力最大。
	if (this.Strength.use_time === undefined)
		return global.MAX_STRENGTH;
	
	// 时间有设置，计算一下当前和上次的差额，体力恢复数。
	var deltaTime = (new Date()) - this.Strength.use_time;
	var ticks = Math.floor(deltaTime / global.UPDATE_STRENGTH_TIME);
	var value = this.Strength.value + ticks;
	if (value >= global.MAX_STRENGTH) {
		this.Strength.use_time = undefined;
		this.Strength.value = global.MAX_STRENGTH;
		return global.MAX_STRENGTH;
	}
	return value;
}

// 添加&消耗体力。
User.prototype.AddStrength = function(value) {
	this.Strength.value = Math.max(this.GetStrength() + value, 0);
	if (this.Strength.value < global.MAX_STRENGTH) {
		// 记录一下消耗体力的时间，便于上面的体力增加计算。
		this.Strength.use_time = new Date();
	}
	else {
		// 时间成本可以忽略了。
		this.Strength.use_time = undefined;
		this.Strength.value = global.MAX_STRENGTH;
	}
	this.Dirty("Strength");
	return this.Strength.value;
}

exports.User = User;
