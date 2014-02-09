
// 关卡类型枚举
const CellType_Normal = 1;
const CellType_Genius = 2;
const CellType_Boss = 3;
const CellType_Extra = 4;
	
// 关卡管理器。
if (global.LevelManager == null) global.LevelManager = new function() {
	// 检查玩家进入关卡的条件。
	this.CheckEnterCondition = function (user, levelInfo) {
		// 1. 检查需要的疲劳值。
		var strength = user.GetStrength();
		if (levelInfo.LimitStrength && 
			levelInfo.LimitStrength > 0 && 
			strength < levelInfo.LimitStrength)
			return "LimitStrengthCheckFailed";
		
		// 2. 检查等级限制。
		if (levelInfo.LimitLv > user.Attrib.Level)
			return "LimitLvCheckFailed";
			
		// 3. 检查物品&金钱限制。
		if (levelInfo.LimitItem > 0 &&
			user.PackageManager.FindByBaseId(levelInfo.LimitItem) === undefined) {
			return "LimitItemCheckFailed";
		}
		
		// 4. 检查前置关卡的条件。
		if (levelInfo.PrePose > 0 && 
			user.LevelInfos !== undefined &&
			user.LevelInfos[levelInfo.PrePose] == null) {
			return "PrePoseCheckFailed";
		}
		
		// 5. 检查临时包裹是不是包含东西（包裹是否已满）。
		if (user.PackageManager.IsFull())
			return "BackPackageIsFull";
			
		return undefined;
	}

	// 生成进入关卡的数据.
	this.BuildLevelData = function(user, levelInfo) {
		var levelData = {
			data: {
				Info: {
					ID: levelInfo.ID,
					WayLength: levelInfo.WayLength,
					ExtraWay: levelInfo.ExtraWay,
					GeniusNum: levelInfo.GeniusNum,
					ExtraNum: levelInfo.ExtraNum,
					Normal1: [levelInfo.MonsterNormal1, levelInfo.M1level, levelInfo.Pool1Num],
					Normal2: [levelInfo.MonsterNormal2, levelInfo.M2level, levelInfo.Pool2Num],
					Genius: [levelInfo.MonsterGenius, levelInfo.M3level, levelInfo.Pool3Num],
					Boss: [levelInfo.MonsterBoss, levelInfo.M4level, levelInfo.Pool4Num],
					Extra: [levelInfo.MonsterExtra, levelInfo.M5Level, levelInfo.Pool5Num],
					Triggers: [
						levelInfo.NormalTrigger, 
						levelInfo.GeniusTrigger, 
						levelInfo.BossTrigger, 
						levelInfo.ExtraTrigger],
				},
				Profit: {
					Gold: levelInfo.TotalGold,
					Exp: levelInfo.TotalExp,
					Soul: levelInfo.TotalSoul,
					SP: levelInfo.TotalSP,
				},
			},
			info: levelInfo,
			progress: [0, 0, 0, 0, 0], // 进程初始值为空。
			drops: {}, // 初始的掉落数据为空。
			revive: 0, // 初始的复活次数为0。
		}
		
		// 3. 生成宝箱的掉落物品。
		if (levelInfo.ChestID > 0 && levelInfo.ChestNum > 0) {
			var monsterAttrib = global.MonsterAttribTable.GetItem(levelInfo.ChestID, levelInfo.ChestLevel);
			if (monsterAttrib) {
				levelData.data.Info.Chest = [levelInfo.ChestID, levelInfo.ChestLevel, levelInfo.ChestNum];
				if (monsterAttrib.Drop > 0) {
					levelData.data.Profit.ChestDrops = [];
					for (var i = 0; i < levelInfo.ChestNum; i++) {
						var chestDrop = {};
						this.Drop(monsterAttrib.Drop, chestDrop, user);
						levelData.data.Profit.ChestDrops.push(chestDrop);
						for (var id in chestDrop)
							levelData.drops[id] = (levelData.drops[id] || 0) + chestDrop[id];
					}
				}
			}
		}
		
		// 注意，掉落物品是通过逐个单元格的开放来申请获得的。
		// 这里可以防止外挂的出现。
		return levelData;
	}

	// 玩家请求进入关卡
	this.EnterLevel = function (user, level, callback) {
		// 关卡的数据。
		var levelInfo = global.LevelSetTable.GetItem(level);
		if (levelInfo === undefined)
			return callback("LevelDoesnotExist");
		
		// 检查玩家进入关卡的条件。
		var err = this.CheckEnterCondition(user, levelInfo);
		if (err != undefined)
			return callback(err);
		
		// 生成进入关卡的数据：迷宫&怪物&掉落物品&等等
		user.levelData = this.BuildLevelData(user, levelInfo);
		
		// 离开城市场景进入副本。。。
		global.CityManager.Leave(user);
		
		callback(undefined, user.levelData.data);

		console.LOG("进入副本: 玩家[%s] 关卡[%d]",
			user.Key(),
			level);
	}
	
	this.Drop = function(dropGroup, drops, user) {
		drops = drops || {};
		// 总概率是【0-1000】。
		var chance = Math.floor(Math.random() * 1001);
		for (var sequence = 1; sequence < 20; sequence++) {
			var dropInfo = global.DropGroupTable.GetItem(dropGroup, sequence);
			if (dropInfo === undefined || dropInfo.Items === undefined) break;
			if (chance < dropInfo.Chance) {
				for (var itemIdx in dropInfo.Items) {
					var itemId = dropInfo.Items[itemIdx];
					var itemBase = global.ItemBaseTable.GetItem(itemId);
					if (itemBase === undefined) continue; // 配置的掉落物品不存在。
					if (itemBase.Role > 0 && 
						itemBase.Role !== user.Attrib.Role) 
						continue; // 不是本职业的东西。
					
					var num = Math.floor(Math.random() * (dropInfo.Max - dropInfo.Min + 1) + dropInfo.Min);
					drops[itemId] = (drops[itemId] || 0) + num;
				}
				break;
			}
			chance -= dropInfo.Chance;
		}
		return drops;
	}

	// 玩家请求一个单元格[type: {1：普通, 2：精英，3：BOSS，4：额外}]
	this.OpenCell = function(user, type, callback) {
		if (user.levelData === undefined)
			return callback("UserNotInLevel");
		
		// 找出对应的掉落组。
		var dropGroups = undefined;
		if (type === CellType_Normal)
			dropGroups = user.levelData.info.NormalDrop;
		else if (type === CellType_Genius)
			dropGroups = user.levelData.info.GeniusDrop;
		else if (type === CellType_Boss)
			dropGroups = user.levelData.info.BossDrop;
		else if (type === CellType_Extra)
			dropGroups = user.levelData.info.ExtraDrop;
		else
			return callback("InvalidParam");
		
		// 生成掉落数据。
		var drop = {};
		var role = user.Attrib.Role;
		for (var i in dropGroups) {
			var dropGroup = dropGroups[i];
			if (dropGroup === 0) continue;
			this.Drop(dropGroup, drop, user);
		}
		
		// 掉落数据叠加，便于结算的时候做统计验证。
		for (var i in drop) {
			if (user.levelData.drops[i] === undefined)
				user.levelData.drops[i] = drop[i];
			else
				user.levelData.drops[i] += drop[i];
		}

		// 添加到关卡进程数据里面，便于结算的时候做比较。
		user.levelData.progress[type]++;
		
		callback(undefined, { drops: drop });
	}

	// 玩家退出关卡
	this.LeaveLevel = function(user, callback) {
		var levelId = undefined;
		if (user.levelData !== undefined) {
			levelId = user.levelData.info.ID;
			// 清除关卡数据。
			delete user.levelData;
		}
			
		// 加入城市场景
		global.CityManager.Enter(user);

		callback(undefined, "LeaveSuccess");
	
		console.LOG("退出副本: 玩家[%s] 关卡[%d]",
			user.Key(),
			levelId);
	}

	// 玩家完成关卡
	this.FinishLevel = function(user, finishInfo, callback) {
		if (user.levelData == null)
			return callback("UserNotInLevel");
			
		var levelSetup = user.levelData.info;
		
		// 检查关卡进程是否合法。
		// [CellType_Normal]类型的最小路径为【主干个数 - 精英个数 - BOSS个数】
		// [CellType_Genius]类型必须等于【精英个数】
		// [CellType_Boss]类型必须等于【1】
		var minNormalNum = levelSetup.WayLength - levelSetup.GeniusNum - 1;
		if (user.levelData.progress[CellType_Normal] < minNormalNum ||
			user.levelData.progress[CellType_Genius] !== levelSetup.GeniusNum ||
			user.levelData.progress[CellType_Boss] !== 1) {
			console.LOG("InvalidLevelProgress: " + JSON.stringify(user.levelData.progress));
			//由于网络的问题，会导致程序出现多次请求进度情况。所以关闭这个检测。
			//return callback("InvalidLevelProgress");
		}
		
		// 检查掉落物品，添加到玩家包裹！
		if (Array.isArray(finishInfo.drops)) {
			for (var i in finishInfo.drops) {
				// 判断客户发送过来的掉落物品。
				var dropInfo = finishInfo.drops[i];
				if (dropInfo.id === undefined || 
					dropInfo.num === undefined)
					continue;
				
				// 只有在生成的里面，而且数据不大于才可以。
				// 在此处关卡检测里面需要检查额外属性的生成。
				var maxNum = user.levelData.drops[dropInfo.id];
				if (maxNum !== undefined && dropInfo.num <= maxNum)
					user.PackageManager.AddItem(dropInfo.id, dropInfo.num)
			}
		}
		
		// 检查关卡的获取（金币&经验等）
		var gold = 0;
		if (finishInfo.gold !== undefined && 
			finishInfo.gold <= user.levelData.data.Profit.Gold)
			gold = finishInfo.gold;
		if (gold > 0) user.AddGold(gold);
		
		// 经验的获取。
		var exp = 0;
		if (finishInfo.exp !== undefined && 
			finishInfo.exp <= user.levelData.data.Profit.Exp)
			exp = finishInfo.exp;
		if (exp > 0) user.AddExp(exp);
		
		// 通关副本的SP的获取。
		if (levelSetup.TotalSP > 0)
			user.AddSP(levelSetup.TotalSP);
		
		// 扣除所需要的疲劳值&物品&消耗品等。
		var limitStrength = levelSetup.LimitStrength;
		if (limitStrength &&
			limitStrength > 0)
			user.AddStrength(-limitStrength);

		// 加入城市场景
		global.CityManager.Enter(user);
		
		// 保存到玩家评分到关卡信息。
		var score = (finishInfo.score || 100);
		var levelId = levelSetup.ID;
		var userLevelInfo = user.LevelInfos[levelId];
		if (userLevelInfo === undefined) userLevelInfo = user.LevelInfos[levelId] = {
			PassCount: 1,
			MaxScore: score,
			LastScore: score};
		userLevelInfo.Time = (new Date()).getTime();
		userLevelInfo.PassCount++;
		userLevelInfo.LastScore = score;
		if (score > userLevelInfo.MaxScore)
			userLevelInfo.MaxScore = score;
		user.Dirty("LevelInfos");
		
		// 更新一下副本进度
		if (user.Attrib.Progress === undefined || 
			user.Attrib.Progress < levelSetup.Progress) {
			user.Attrib.Progress = levelSetup.Progress;
			user.Dirty("Attrib");
		}
		
		// 保存一下，副本转盘的数据。
		user.TurntableData = { LevelSetup: levelSetup };
		
		// 打印一下日志。
		console.LOG("完成副本: 玩家[%s] 关卡[%d] 金币[%d] 经验[%d] 掉落物品[-]",
			user.Key(),
			levelSetup.ID,
			gold,
			exp);

		// 清除关卡数据。
		delete user.levelData;
		
		// 成功回调。
		callback(undefined, "FinishLevelSuccess");
	}

	// 获取复活的次数。
	this.GetReviveInfo = function(user, callback) {
		if (user.levelData === undefined)
			return callback("UserNotInLevel");
		
		var revive = (user.ReviveInfo.Count || 0);
		if (revive < global.FREE_REVIVE_TIME) // 免费次数
			revive = revive - global.FREE_REVIVE_TIME;
		else if (user.levelData.revive > 0) // 付费次数
			revive = user.levelData.revive;
		else {
			revive = 0;
			
			var now = new Date();
			if (user.ReviveInfo.Time === undefined ||
				user.ReviveInfo.Time.getMonth() != now.getMonth() ||
				user.ReviveInfo.Time.getDate() != now.getDate()) {
				user.ReviveInfo.Count = 0;
				revive = revive - global.FREE_REVIVE_TIME;
			}
		}
		
		callback(undefined, revive);
	}

	// 调用复活的接口，服务器扣除复活所需要的钻石。
	this.Revive = function(user, callback) {
		if (user.levelData === undefined)
			return callback("UserNotInLevel");
			
		user.ReviveInfo.Time = new Date();
		user.ReviveInfo.Count = (user.ReviveInfo.Count || 0) + 1;
		
		var cost = 0;
		if (user.ReviveInfo.Count > global.FREE_REVIVE_TIME) {
			// 叠加复活次数
			user.levelData.revive++;
			
			// 查看复活钻石需求。
			var viveBase = global.ReviveBaseTable.GetItem(user.levelData.revive);
			if (viveBase !== undefined) {
				cost = viveBase.Cost;
				if (user.Attrib.Gem < cost)
					return callback("NotEnoughGem");
				// 扣除钻石。
				user.AddGem(-cost);
			}
		}

		console.LOG("副本复活: 玩家[%s] 关卡[%d] 当天复活次数[%d] 当前关卡复活次数[%d] 钻石[%d]",
			user.Key(),
			user.levelData.info.ID,
			user.ReviveInfo.Count,
			user.levelData.revive,
			cost);
			
		callback(undefined, "ReviveSuccess");
	}
}

// 玩家请求进入关卡
exports.EnterLevel = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.LEVEL)
		return response.Error("LevelDisabled");

	var level = params.level;
	if (isNaN(level))
		return response.Error("InvalidParam");
	
	global.LevelManager.EnterLevel(user, level, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret, "LevelData");
	});
}

// 玩家请求一个单元格
exports.OpenCell = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	var type = params.type;
	if (isNaN(type) || (type !== CellType_Normal && type !== CellType_Genius && type !== CellType_Boss && type !== CellType_Extra))
		return response.Error("InvalidParam");
	
	global.LevelManager.OpenCell(user, type, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret, "DropInfo");
	});
}

// 玩家退出关卡
exports.LeaveLevel = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
	
	global.LevelManager.LeaveLevel(user, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 玩家完成关卡
exports.FinishLevel = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
	
	global.LevelManager.FinishLevel(user, params, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 获取到复活所需要的信息
exports.GetReviveInfo = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
	
	global.LevelManager.GetReviveInfo(user, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send({ Count: ret }, "ReviveInfo");
	});

}

// 玩家在关卡内复活
exports.Revive = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined) 
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.REVIVE) 
		return response.Error("ReviveDisabled");
		
	global.LevelManager.Revive(user, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 获取玩家的pve数据。
exports.GetPveInfo = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
	
	var data = { Levels: user.LevelInfos };
	response.Send(data, "PveInfo");
}

// 获取到副本转盘奖励数据。
exports.GetTurntableData = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
	
	//TurntableGroups Turntable1 Turntable2 Turntable3
	var turntableData = user.TurntableData;
	if (turntableData === undefined) {
        console.log("1 error: NoTurntableData");
		return response.Error("NoTurntableData");
    }
	// 第一次生成转盘数据。
	if (turntableData.Group === undefined) {
		var levelSetup = turntableData.LevelSetup;

        var chance = Math.random() * 1000;
        console.log("levelSetup.TurntableChance=" + levelSetup.TurntableChance + ", change=" + chance)
        /*  raogangshan 2014-01-09 21:52 [客户端出现不信任数据]
		// 转盘添加了随机值判断。
		var chance = Math.random() * 1000;
		if (levelSetup.TurntableChance > 0 && chance > levelSetup.TurntableChance) {
			delete user.TurntableData;
            console.log("2 error: NoTurntableData");
			return response.Error("NoTurntableData");
		}
		*/

		if (Array.isArray(levelSetup.TurntableGroups) &&
			levelSetup.TurntableGroups.length > 0) {
			var chooseIdx = Math.floor(Math.random() * levelSetup.TurntableGroups.length);
			turntableData.Group = levelSetup.TurntableGroups[chooseIdx];
		}
	}
	var ret = turntableData.Group || 0;
	response.Send(ret.toString());
}

// 获取副本转盘奖励。
exports.FetchTurntableReward = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
	
	//TurntableGroups Turntable1 Turntable2 Turntable3
	var turntableData = user.TurntableData;
	if (turntableData === undefined ||
		turntableData.Group === undefined) {
        console.log("3 error: NoTurntableData");
		return response.Error("NoTurntableData");
    }
	// 转盘次数叠加。
	var count = turntableData.Count || 1;
	if (count > global.TURN_TABLE_NUM)
		return response.Error("TurntableTooMuch");

	// 检查钻石是否充足。【Turntable1 Turntable2 Turntable3】
	var gemCost = turntableData.LevelSetup['Turntable' + count];
	if (gemCost === undefined)
		return response.Error("TurntableCostNotFound");
		
	if (gemCost > user.Attrib.Gem)
		return response.Error("NotEnoughGem");

	// 获取转到的目标，这里注意不能和之前随机到的物品重复。
	if (!turntableData.Sequences) {
		turntableData.Sequences = [];
		for (var i = 1; i <= global.TURN_TABLE_NUM; i++)
			turntableData.Sequences.push(i);
	}
	var index = Math.floor(Math.random() * turntableData.Sequences.length);
	var sequence = turntableData.Sequences[index];
	turntableData.Sequences.splice(index, 1);
	
	// 获取奖励。
	var dropInfo = global.DropGroupTable.GetItem(turntableData.Group, sequence);
	if (dropInfo === undefined)
		return response.Error("TurntableDataError");

	if (Array.isArray(dropInfo.Items) && dropInfo.Items.length > 0) {
		for (var itemIdx in dropInfo.Items) {
			var itemId = dropInfo.Items[itemIdx];
			var itemBase = global.ItemBaseTable.GetItem(itemId);
			if (itemBase === undefined) continue; // 配置的掉落物品不存在。
			if (itemBase.Role > 0 && 
				itemBase.Role !== user.Attrib.Role) 
				continue; // 不是本职业的东西。
			
			var num = Math.floor(Math.random() * (dropInfo.Max - dropInfo.Min + 1) + dropInfo.Min);
			user.PackageManager.AddItem(itemBase, num)
		}
	}
	if (dropInfo.Gold > 0) user.AddGold(dropInfo.Gold);
	if (dropInfo.SP > 0) user.AddSP(dropInfo.SP);
	if (dropInfo.Exp > 0) user.AddExp(dropInfo.Exp);
	if (dropInfo.Gem > 0) user.AddGem(dropInfo.Gem);
	
	// 扣款。
	if (gemCost > 0) user.AddGem(-gemCost);
	
	// 记录。
	turntableData.Count = count + 1;
	
	// 发送中奖的信息给客户端。
	response.Send(sequence.toString());
}
