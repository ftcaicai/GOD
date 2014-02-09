
const ItemType_Equip = 1;
const ItemType_Rune = 2;
const ItemType_Stone = 3;
const ItemType_Props = 4;
const ItemType_Skill = 5;
			
// 登录管理器。
if (global.LoginManager === undefined) global.LoginManager = new function() {
	this.InitProfiles = {};
	
	this.FetchRoleList = function(id, callback) {
		// 连接数据库
		global.Service.Database.collection(global.TABLES.USER, function(err, collection) {
			if (err != null || collection == null)
				return callback('DatabaseError');
			
			// 将此玩家的信息从数据里面加载起来。避开已经删除掉的角色【deleted】存在
			var query = {id: id, deleted: {$exists: false}};
			var filter = {_id: false, 
				'Attrib.Name': true, 
				'Attrib.Role': true, 
				'Attrib.Level': true};
			collection.find(query, filter).toArray(function(err, docs) {
				var roleList = { users: [] };
				if (docs != undefined && docs.length > 0) {
					for (var i in docs) roleList.users.push(docs[i].Attrib);
				}
				
				// 回调成功了呗.
				callback(undefined, roleList);
			});
		});
	}

	// 登录一个帐号，返回角色列表。
	// 玩家需要选择一个角色进入游戏。
	this.Login = function(connection, id, callback) {
		// 调用帐号登录。
		var err = global.AccountManager.Login(connection, id);
		if (err) return callback(err);
		
		this.FetchRoleList(id, callback);
		
		console.LOG("帐号登录: 帐号[%s]", id);
	}
	
	// 重新登录。
	this.ReLogin = function(connection, id, key, callback) {
		// 调用帐号登录。
		var err = global.AccountManager.ReLogin(connection, id);
		if (err) return callback("AccountLoginFailed");
		
		// 确认该帐号未登录。
		//if (global.AccountManager.Find(id) !== undefined)
		//	return callback("AccountAlreadyLogin");
			
		// 确认该角色未登录。
		//if (global.UserManager.Find(key) !== undefined)
		//	return callback("UserAlreadyLogin");

		// 调用用户登录。
		global.UserManager.UserRelogin(connection, id, key, function(err, user) {
			if (err) {
				global.AccountManager.Logout(connection, id);
				return callback(err);
			}
			callback(undefined, "ReLoginSuccess");
		});
	}
	
	// 创建一个角色。
	this.CreateUser = function(id, name, role, callback) {
		global.Service.Database.collection(global.TABLES.USER, function(err, collection) {
			if (err != null || collection == null)
				return callback('DatabaseError');
			
			// 从数据库里面查询一下，注意这里是已经被删除的玩家也需要包含。
			collection.findOne({user: name}, {_id: true}, function(err, item) {
				if (item != null)
					return callback('NameAlreadyUsed');
				
				// 创建玩家的基础信息。
				var profile = global.LoginManager.CreateProfile(id, name, role);
				if (profile === undefined)
					return callback('CreateProfileFail');
				
				// 插入数据库。
				collection.insert(profile, function(err, item) {
					if (err != null)
						return callback('DatabaseError');

					// 返回角色列表。
					global.LoginManager.FetchRoleList(id, callback);
					
					console.LOG("创建角色: 帐号[%s] 玩家[%s] 职业[%d]", id, name, role);
				});
			});
		});
	}

	// 删除一个角色。
	this.DeleteUser = function(id, name, callback) {
		global.Service.Database.collection(global.TABLES.USER, function(err, collection) {
			if (err || collection === undefined)
				return callback('DatabaseError');

			var query = {id: id, user: name};
			var sort = [];
			var update = {$set: {deleted: true}};
			collection.findAndModify(query, sort, update, function(err, item) {
				if (err || item === undefined)
					return callback('UserNotFound');
				
				// 返回角色列表。
				global.LoginManager.FetchRoleList(id, callback);

				console.LOG("删除角色: 玩家[%s]", name);
			});
		});
	}
	
	this.InitPackages = function(role) {
		var packages = {
			BackPack: { 
				Pages: global.DEFAULT_BACKPACK_PAGE, // 默认的页卡数。
				IdBase: 1, // 起始id设置为1，避免0的出现吧。
				Items: {},
			},
			SkillPack: {
				Items: {},
			},
		};
		
		// 创建一下默认装备这个玩意。
		for (var i = 1; i < 10; i++) {
			var defaultItem = global.DefaultPlayerEquipTable.GetItem(role, i);
			if (defaultItem === undefined)
				break;
			
			// 处理物品～
			var itemId = defaultItem.Item;
			if (itemId == 0 || defaultItem.Number == 0)
				continue;
				
			var itemBase = global.ItemBaseTable.GetItem(itemId);
			if (itemBase === undefined)
				continue;
				
			var newId = packages.BackPack.IdBase++;
			var item = { ID: newId, Base: itemId, Attrib: {} };
			if (defaultItem.Equiped > 0) item.Attrib.Equip = 1; // 装备上去。
			
			// 技能的处理。
			if (itemBase.MainType === ItemType_Skill) {
				newId = item.ID = itemId;
				item.Attrib.Lv = 1;
				packages.SkillPack.Items[newId] = item;
			}
			else {
				// 添加到包裹。
				item.Num = defaultItem.Number;
				packages.BackPack.Items[newId] = item;
			}
		}
		
		return packages;
	}
	
	this.CreateRoleProfile = function(role) {
		// create the main attribute.
		var level = 1; // default is level 1.
		var attribBase = global.PlayerAttribTable.GetItem(role, level);
		if (attribBase === undefined) {
			console.log("角色表中未找到数据：" + role);
			return undefined;
		}
		
		// copy the attributes
		var attrib = {
			//Name: user,
			Role: role,
			Level: 1,
			CurHP: attribBase.HPMax,
			CurExp: 0,
			Gold: 0, // 初始的金币配置。
			CostGold: 0,
			TotalGold: 0,
			Gem: 0, // 初始的钻石配置。
			CostGem: 0,
			TotalGem: 0,
			Battle: 0,
			Progress: 0, // 副本的进度
			SP: 0, // 技能点
			PvpExp: 0, // pvp的经验
			PvpLevel: 1, // pvp的等级
		};
		for (var i in attribBase)
			attrib[i] = attribBase[i];
		
		var packages = this.InitPackages(role);
		
		// create the default package.
		var profile = {
			//id: id,
			//user: user,
			Attrib: attrib, // 属性
			Packages: packages, // 背包
			LevelInfos: {}, // 副本
			Mails: [], // 邮件
			LoginInfo: {}, // 登录
			Friends: {}, // 好友
			Quests: {}, // 任务
			Strength: {}, // 体力
			PvpInfo: {}, // 竞技
		};
		return profile;
	}
	
	// 创建初始玩家的信息～
	this.CreateProfile = function(id, user, role) {
		if (this.InitProfiles[role] === undefined) {
			var roleProfile = this.CreateRoleProfile(role);
			if (roleProfile === undefined)
				return undefined;
				
			this.InitProfiles[role] = JSON.stringify(roleProfile);
		}
		var profile = JSON.parse(this.InitProfiles[role]);
		profile.id = id;
		profile.user = user;
		profile.Attrib.Name = user;
		return profile;
	}
};

// 玩家登录，支持用帐号登录。
// 登录之后在网络连接上绑定帐号account
exports.Login = function(service, params, connection, response) {
    // go to the database.
    var id = params.id;
	if (id === undefined)
		return response.Error("InvalidParam");

	global.LoginManager.Login(connection, id, function(err, roleList) {
		if (err) {
			console.LOG("登录失败: " + err + " account=" + id);
			return response.Error(err);
		}
		
		response.Send(roleList, "RoleList");
	});
}

// 断线后的重新登录。
exports.ReLogin = function(service, params, connection, response) {
    // go to the database.
    var id = params.id;
	var user = params.user;
	if (id === undefined || user === undefined)
		return response.Error("InvalidParam");

	// 检查一下是否已经绑定了数据。
	if (connection.account !== undefined || connection.user !== undefined)
		return response.Error("ConnectionAlreadyBind");

	global.LoginManager.ReLogin(connection, id, user, function(err, ret) {
		if (err)
			return response.Error(err);
		response.Send(ret);
	});
}

// 创建角色（需要先登录才行）
// 参数id为唯一标识号
// 参数user为名字
// 参数role为职业
exports.CreateUser = function(service, params, connection,  response) {
    // go to the database.
    var id = connection.account;
	if (id === undefined)
		return response.Error("AccountNotLogin");
		
    var user = params.user;
    var role = params.role;
	if (id === undefined || user === undefined || isNaN(role))
		return response.Error("InvalidParam");

	// 当玩家还在游戏内的时候，禁止创建角色。
	if (connection.user !== undefined)
		return response.Error("UserInGame");
	
	// 检测一下是否为关键字.
	if (global.RESERVED_NAMES.indexOf(user.toLowerCase()) >= 0)
		return response.Error("NameIsReserved");

	global.LoginManager.CreateUser(id, user, role, function(err, roleList) {
		if (err != null) {
			console.LOG("创建失败: " + err);
			return response.Error(err);
		}
		
		response.Send(roleList, "RoleList");
	});
}

// 删除角色
exports.DeleteUser = function(service, params, connection,  response) {
	var id = connection.account;
	if (id === undefined)
		return response.Error("AccountNotLogin");
		
	var user = params.user;
	if (id === undefined || user === undefined)
		return response.Error("UserNotLogin");
	
	// 当玩家还在游戏内的时候，禁止删除角色。
	if (connection.user !== undefined)
		return response.Error("UserInGame");
	
	global.LoginManager.DeleteUser(id, user, function(err, roleList) {
		if (err)
			return response.Error(err);
		response.Send(roleList, "RoleList");
	});
}

// 获取登录的信息。
exports.GetLoginInfo = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	var loginInfo = {
		SignInCount: user.LoginInfo.SignInCount,
		LastLoginIp: user.LoginInfo.LastLoginIp,
	};
	
	var now = new Date();
	if (user.LoginInfo.SignInDate === undefined ||
		user.LoginInfo.SignInDate.getDate() !== now.getDate() ||
		user.LoginInfo.SignInDate.getMonth() !== now.getMonth())
		loginInfo.CanSignIn = true;

	return response.Send(loginInfo, "LoginInfo");
}

// 签到
exports.SignIn = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.SINGIN)
		return response.Error("SinginDisabled");
		
	var now = new Date();
	if (user.LoginInfo.SignInDate !== undefined &&
		user.LoginInfo.SignInDate.getDate() === now.getDate() &&
		user.LoginInfo.SignInDate.getMonth() === now.getMonth())
		return response.Send("AlreadySignIn");
	
	var day = ((user.LoginInfo.SignInCount || 0) % global.MAX_SIGNIN_DAY) + 1;
	var signInBase = global.SignInBaseTable.GetItem(day);
	if (signInBase === undefined)
		return response.Error("SignInCountNotFound");

	// 可以签到，记录次数
	user.LoginInfo.SignInCount = day;
	user.LoginInfo.SignInDate = now;
	
	// 获取奖励。
	if (signInBase.Gold > 0) user.AddGold(signInBase.Gold);
	if (signInBase.SP > 0) user.AddSP(signInBase.SP);
	if (signInBase.Exp > 0) user.AddExp(signInBase.Exp);
	if (signInBase.Gem > 0) user.AddExp(signInBase.Gem);
	if (signInBase.Strength > 0) user.AddStrength(signInBase.Strength);
	if (Array.isArray(signInBase.Items) && signInBase.Items.length > 2) {
		for (var i = 0; i < signInBase.Items.length - 1; i += 2) {
			var itemId = signInBase.Items[i];
			var itemNum = signInBase.Items[i+1];
			var itemBase = global.ItemBaseTable.GetItem(itemId);
			if (itemBase === undefined) continue; // 所配置的物品不存在。
			if (itemBase.Role > 0 && 
				itemBase.Role !== user.Attrib.Role)
				continue; // 物品不是本职业的东西。
			user.PackageManager.AddItem(itemBase, itemNum);
		}
	}

	console.LOG("签到奖励: 玩家[%s] 签到次数[%d] 金币[%d] SP[%d] 经验[%d] 体力[%d] 物品[%s]", 
		user.Key(), 
		day,
		signInBase.Gold,
		signInBase.SP,
		signInBase.Exp,
		signInBase.Strength,
		JSON.stringify(signInBase.Items));
		
	return response.Send("SignInSuccess");
}

// 完成新手引导。
exports.FinishNewGuide = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	var id = (params.id || 0);
	user.Attrib.NewGuide = (user.Attrib.NewGuide || 0) | (1 << id);
	user.Dirty("Attrib");
	response.Send("FinishNewGuideSucess");
}
