
// 技能升级&符文的处理
if (global.SkillManager == null) global.SkillManager = new function() {

	// 初始化技能的设定。
	this.Init = function(user) {
		var skillPack = user.PackageManager.SkillPack();
		if (skillPack.Items === undefined)
			skillPack.Items = {};
	}
	
	// 技能学习&升级所需要的条件。
	// 不符合条件将返回错误信息，否则将扣除所需要的资源（金币/钻石/SP等）
	this.CheckSkillCost = function(user, skillAttrib, op) {
		if (user.Attrib.Level < skillAttrib.LevelRequest)
			return "LevelNotMatch";

		// SP不够的情况下，转换为钻石消耗。
		var costSP = skillAttrib.SP;
		var costGem = skillAttrib.Gem;
		var costGold = skillAttrib.Gold;
		if (costSP > 0 && user.Attrib.SP < costSP) {
			costSP = 0;
			costGem += Math.ceil(skillAttrib.SP / global.GEM_TO_SP);
		}

		// 检测是否足够。
		if (user.Attrib.Gem < costGem) return "NotEnoughGem";
		if (user.Attrib.Gold < costGold) return "NotEnoughGold";
		if (user.Attrib.SP < costSP) return "NotEnoughSP";

		// 扣款
		if (costSP > 0) user.AddSP(-costSP);
		if (costGem > 0) user.AddGem(-costGem);
		if (costGold > 0) user.AddGold(-costGold);

		// 记录消费
		global.RecordManager.Consume(user, "skill", skillAttrib.ID, op, 1, costGold, costGem, costSP);
		
		return undefined;
	}

	// 技能的学习
	this.Learn = function(user, id, callback) {
		// 1. 检查该技能是否已经存在。
		var skillPack = user.PackageManager.SkillPack();
		if (skillPack.Items[id] !== undefined)
			return callback("SkillAlreadyExist");
		
		// 2. 检查该技能是否存在表里。
		var lv = 1;
		var skillAttrib = global.SkillAttribTable.GetItem(id, lv);
		if (skillAttrib === undefined)
			return callback("SkillNotFound");
		
		// 3. 检测技能的学习条件。SP点数。
		var err = this.CheckSkillCost(user, skillAttrib, "learn");
		if (err) return callback(err);
			
		// 看看需不需要自动给他装配上去。
		// 找到该技能的类型，方便一下的替换。
		var autoEquip = true;
		var skillBase = global.SkillBaseTable.GetItem(id);
		if (skillBase !== undefined) {
			for (var i in skillPack.Items) {
				var otherItem = skillPack.Items[i];
				if (otherItem.Attrib.Equip === 1) {
					var otherItemBase = global.SkillBaseTable.GetItem(otherItem.Base);
					if (otherItemBase !== undefined && otherItemBase.Type === skillBase.Type) {
						// 如果已经存在这样的技能了，则不需要给他自动装配了。
						autoEquip = false;
						break;
					}
				}
			}
		}
		
		// 创建一个新的技能。
		var skillItem = {
			ID: id,
			Base: id,
			Attrib: { Lv: 1 },
		};
		
		// 自动装配
		if (autoEquip) skillItem.Attrib.Equip = 1;
		
		// 将技能添加到包裹。
		skillPack.Items[id] = skillItem;
		
		// 数据被修改，需要存数据库。
		user.Dirty("Packages");
		
		// 成功回调。
		callback(undefined, "LearnSuccess");
		
		console.LOG("学习技能: 玩家[%s] 技能[%d]",
			user.Key(),
			id);
	}

	// 技能的升级
	this.Upgrade = function(user, id, callback) {
		// 检测技能的升级条件。
		var skillPack = user.PackageManager.SkillPack();
		var skill = skillPack.Items[id];
		if (skill === undefined)
			return callback("SkillNotFound");

		// 技能是一级一级升上去的。
		var lv = (skill.Attrib.Lv || 1) + 1;
		var skillAttrib = global.SkillAttribTable.GetItem(id, lv);
		if (skillAttrib === undefined)
			return callback("SkillNotFound");
	
		// 3. 检测技能的学习条件。SP点数。
		var err = this.CheckSkillCost(user, skillAttrib, "upgrade");
		if (err) return callback(err);
	
		// 设置新的等级。
		skill.Attrib.Lv = lv;
		user.Dirty("Packages");

		// 成功回调。
		callback(undefined, "UpgradeSuccess");

		console.LOG("升级技能: 玩家[%s] 技能[%d] 等级[%d]",
			user.Key(),
			id,
			lv);
	}

	// 技能的装备
	this.Equip = function(user, id, callback) {
		// 获取技能背包中的对应技能。
		var skillPack = user.PackageManager.SkillPack();
		var skill = skillPack.Items[id];
		if (skill === undefined)
			return callback("SkillNotFound");

		// 技能已经被装配上了
		if (skill.Attrib.Equip === 1)
			return callback("SkillAlreadyEquiped");

		// 找到该技能的类型，方便一下的替换。
		var skillBase = global.SkillBaseTable.GetItem(skill.Base);
		if (skillBase === undefined)
			return callback("SkillNotFoundInTable");

		// 替换之前装备的技能。
		for (var i in skillPack.Items) {
			var otherItem = skillPack.Items[i];
			if (otherItem.Attrib.Equip === 1) {
				var otherItemBase = global.SkillBaseTable.GetItem(otherItem.Base);
				if (otherItemBase !== undefined && otherItemBase.Type === skillBase.Type) {
					// 卸下这个装备的技能。
					delete otherItem.Attrib.Equip;
					break;
				}
			}
		}

		// 装备该技能
		skill.Attrib.Equip = 1;

		user.Dirty("Packages");
		
		callback(undefined, "EquipSuccess");

		console.LOG("装备技能: 玩家[%s] 技能[%d]",
			user.Key(),
			id);
	}

	// 技能的添加槽位
	this.BuySlot = function(user, id, callback) {
		// 获取技能背包中的对应技能。
		var skillPack = user.PackageManager.SkillPack();
		var skill = skillPack.Items[id];
		if (skill === undefined)
			return callback("SkillNotFound");
		
		// 读取技能基础表格。
		var skillBase = global.SkillBaseTable.GetItem(skill.Base);
		if (skillBase === undefined)
			return callback("SkillBaseNotFound");
		
		// 默认包含一个槽位。
		// slot槽位是按Slot1,Slot2,Slot3,Slot4来的。
		var newSlotNum = (skill.Attrib.SlotNum || 1) + 1;
		var coseGold = (newSlotNum != 4);
		var price = skillBase["Slot" + newSlotNum];
		if (price === undefined)
			return callback("SkillSlotNotFound");
		
		// 检查消耗
		if (coseGold && user.Attrib.Gold < price)
			return callback("NotEnoughGold");
		
		if (!coseGold && user.Attrib.Gem < price)
			return callback("NotEnoughGem");
		
		// 扣款
		if (price > 0) {
			if (coseGold) user.AddGold(-price);
			else user.AddGem(-price);
		}
		
		// 增加槽位
		skill.Attrib.SlotNum = newSlotNum;
		
		callback(undefined, "BuySkillSlotSuccess");

		user.Dirty("Packages");
		
		// 记录消费
		global.RecordManager.Consume(user, "skill", id, "slot", newSlotNum, price, 0);
		
		console.LOG("购买技能槽位: 玩家[%s] 技能[%d]",
			user.Key(),
			id);
	}

	// 技能的符石
	this.AddRune = function(user, id, rune, slot, callback) {
		// 获取技能背包中的对应技能。
		var skillPack = user.PackageManager.SkillPack();
		var skill = skillPack.Items[id];
		if (skill === undefined)
			return callback("SkillNotFound");
		
		var runeItem = user.PackageManager.FindItem(rune);
		if (runeItem === undefined) 
			return callback("RuneNotFound");
		
		const ItemType_Rune = 2;
		var runeBase = global.ItemBaseTable.GetItem(runeItem.Base);
		if (runeBase === undefined || runeBase.MainType != ItemType_Rune) 
			return callback("RuneBaseNotFound");

		// 检查之前的符石，是否需要替换一下。
		var slotIndex = undefined;
		var runsInSlot = [
			skill.Attrib.Slot1,
			skill.Attrib.Slot2,
			skill.Attrib.Slot3,
			skill.Attrib.Slot4];
		for (var i in runsInSlot) {
			var otherRune = runsInSlot[i];
			if (otherRune === undefined)
				continue;
			
			var otherRuneBase = global.ItemBaseTable.GetItem(otherRune);
			if (otherRuneBase !== undefined && otherRuneBase.SubType === runeBase.SubType) {
				// 低级符文不能替换高级符文。
				if (otherRuneBase.Level >= runeBase.Level)
					return callback("RuneCanotReplace");
				slotIndex = parseInt(i);
			}
		}
		
		// 若没有替换，则在目标上添加。
		if (slotIndex === undefined)
			slotIndex = slot - 1;
		
		// 默认包含一个槽位。
		var slotNum = (skill.Attrib.SlotNum || 1);
		if (slotIndex >= slotNum) 
			return callback("NotEnoughSlot");
		
		// 从背包中删除符石物品。
		user.PackageManager.RemoveItem(rune, 1);
		
		// 添加到技能的属性上去。
		slot = slotIndex + 1;
		skill.Attrib["Slot" + slot] = runeItem.Base;
		
		callback(undefined, "AddRuneSuccess");
			
		user.Dirty("Packages");
		
		console.LOG("技能符石: 玩家[%s] 技能[%d] 符文[%s]",
			user.Key(),
			id,
			runeBase.Name);
	}
}

// 技能的学习
// 参数id为技能的id编号
exports.SkillLearn = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined) 
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.SKILL)
		return response.Error("SkillDisabled");
		
	var id = params.id;
	if (isNaN(id)) 
		return response.Error("InvalidParam");

	global.SkillManager.Learn(user, id, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 技能的升级
exports.SkillUpgrade = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.SKILL)
		return response.Error("SkillDisabled");
		
	var id = params.id;
	if (isNaN(id))
		return response.Error("InvalidParam");

	global.SkillManager.Upgrade(user, id, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 技能的装备
exports.SkillEquip = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined) 
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.SKILL)
		return response.Error("SkillDisabled");
		
	var id = params.id;
	if (isNaN(id))
		return response.Error("InvalidParam");

	global.SkillManager.Equip(user, id, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 技能购买槽位
exports.SkillBuySlot = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.SKILL)
		return response.Error("SkillDisabled");
		
	var id = params.id;
	if (isNaN(id))
		return response.Error("InvalidParam");

	global.SkillManager.BuySlot(user, id, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 技能的符石。
exports.SkillAddRune = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.SKILL)
		return response.Error("SkillDisabled");
		
	var id = params.id;
	var rune = params.rune;
	var slot = params.slot;
	if (isNaN(id) || isNaN(rune) || slot === undefined)
		return response.Error("InvalidParam");

	global.SkillManager.AddRune(user, id, rune, slot, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

