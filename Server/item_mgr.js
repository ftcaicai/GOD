
// item main type.
const ItemType_Equip = 1;
const ItemType_Rune = 2;
const ItemType_Stone = 3;
const ItemType_Props = 4;
const ItemType_Skill = 5;

// attribute
const Attrib_True = 1;
const Attrib_False = 0;

// 物品道具的管理器。
if (global.ItemManager == null) global.ItemManager = new function() {

	// 装备的穿戴。
	this.Equip = function(user, id, callback) {
		// 1. 检测玩家是否具有该物品
		var backPack = user.PackageManager.BackPack();
		var item = backPack.Items[id];
		if (item === undefined)
			return callback("ItemNotInBackPack"); // 背包中不存在该物品.
			
		// 2. 检测该物品是否已经装备了。
		if (item.Attrib.Equip === Attrib_True)
			return callback("ItemAlreadyEquiped");

		// 3. 检测该物品能否被装备。
		var itemBase = global.ItemBaseTable.GetItem(item.Base);
		if (itemBase === undefined)
			return callback("ItemNotFoundInTable");
			
		// 物品是否属于可穿戴的装备。
		if (itemBase.MainType !== ItemType_Equip)
			return callback("ItemCanNotEquip");
			
		// 物品的使用等级。
		if (user.Attrib.Level < itemBase.Level)
			return callback("LevelNotMatch");

		// 4. 替换之前的装备。
		for (var i in backPack.Items) {
			var otherItem = backPack.Items[i];
			if (otherItem.Attrib.Equip === Attrib_True) {
				var otherItemBase = global.ItemBaseTable.GetItem(otherItem.Base);
				if (otherItemBase !== undefined && otherItemBase.SubType === itemBase.SubType
                    && otherItemBase.MainType === ItemType_Equip) {
					// 卸下这个装备。
					delete otherItem.Attrib.Equip;
					break;
				}
			}
		}

		// 5. 设置该装备上去。
		item.Attrib.Equip = Attrib_True;

		// 6. 更新玩家的属性。
		user.UpdateAttrib();

		callback(undefined, "EquipSuccess");                                                                      

		console.LOG("穿戴装备: 玩家[%s] ID[%d] 物品[%d] 名称[%s]",
			user.Key(),
			id,
			item.Base,
			itemBase.Name);
	}

    // 装备的卸下。
    this.UnEquip = function(user, id, callback) {
        // 1. 检测玩家是否具有该物品
        var backPack = user.PackageManager.BackPack();
        var item = backPack.Items[id];
        if (item === undefined) {
            callback("ItemNotInBackPack"); // 背包中不存在该物品.
            return;
        }

        // 2. 检测该装备是否已经卸下。
        if (item.Attrib.Equip === undefined
                || item.Attrib.Equip === Attrib_False ) {
            callback("ItemAlreadyUnEquip");
            return;
        }

        // 3. 检测该物品是否属于装备。
        var itemBase = global.ItemBaseTable.GetItem(item.Base);
        if (itemBase === undefined || itemBase.MainType !== ItemType_Equip) {
            callback("ItemIsNotEquips");
            return;
        }

        // 4. 卸下装备。
        delete  item.Attrib.Equip;
        // 5. 更新玩家的属性。
        user.UpdateAttrib();

        callback(undefined, "UnEquipSuccess");

        console.LOG("卸下装备: 玩家[%s] ID[%d] 物品[%d] 名称[%s]",
            user.Key(),
			id,
            item.Base,
            itemBase.Name);
    }


    // 物品的合并（如符石&强化石等）。
	this.Combine = function(user, id, time, callback) {
		//if (user.PackageManager.IsFull())
		//	return callback("BackPackageIsFull");
			
		// 1. 检查包裹里面是否包含需求物品id
		var item = user.PackageManager.FindItem(id);
		if (item === undefined)
			return callback("ItemNotInBackPack"); // 背包中不存在该物品.

		// 2. 检测物品能否被找到基础数据。
		var itemBase = global.ItemBaseTable.GetItem(item.Base);
		if (itemBase === undefined)
			return callback("ItemBaseNotFound");

		// 3. 检测物品的类型（只有符文和强化石才可以被合并）。
		if (itemBase.MainType !== ItemType_Rune &&
			itemBase.MainType !== ItemType_Stone)
			return callback("ItemCanNotCombine");

		// 4. 该符文或者强化石能否被合成。
		var combineBase = global.CombineBaseTable.GetItem(item.Base);
		if (combineBase === undefined)
			return callback("ItemCanNotCombine");
			
		// 4.5 合成所需要的物品是否存在。
		var costItem = undefined;
		if (combineBase.Item && combineBase.ItemNum > 0) {
			costItem = user.PackageManager.FindByBaseId(combineBase.Item);
			if (costItem === undefined)
				return callback("CostItemNotFound");
			if (costItem.Num < combineBase.ItemNum * time)
				return callback("CostItemNotEnough");
		}
			
		var totalGold = combineBase.Gold * time;
		var totalNum = combineBase.Num * time;

		// 5. 玩家金币是否够。
		if (user.Attrib.Gold < totalGold)
			return callback("NotEnoughGold"); // 错误，金币不够。

		// 6. 是否具有足够的个数。
		if (item.Num < totalNum)
			return callback("NotEnoughNum"); // 错误，个数不够。

		// 7. 目标～～
		var targetBase = global.ItemBaseTable.GetItem(combineBase.Target);
		if (targetBase === undefined)
			return callback("TargetNotFound");

		// 8. 扣除物品。
		if (!user.PackageManager.RemoveItem(id, totalNum))
			return callback("RemoveItemFail");

		// 8.1 扣除消耗物品
		if (costItem !== undefined) {
			if (!user.PackageManager.RemoveItem(costItem.ID, combineBase.ItemNum * time))
				return callback("RemoveCostItemFail");
		}
		
		// 9. 扣款
		if (totalGold > 0)
			user.AddGold(-totalGold);

		// 10. 添加合成结果到背包。
		user.PackageManager.AddItem(targetBase, time);

		callback(undefined, "CombineSuccess");
		
		// 记录消费
		global.RecordManager.Consume(user, "combine", itemBase.ID, itemBase.Name, time, totalGold, 0);

		console.LOG("物品合成: 玩家[%s] ID[%d] 物品[%d] 名称[%s] 个数[%d] 生成[%s] 金币[%d]",
			user.Key(),
			id,
			item.Base,
			itemBase.Name,
			totalNum,
			targetBase.Name,
			combineBase.Gold);
	}
	
	// 装备的强化
	this.Strengthen = function(user, equipId, stoneId, callback) {
		// 1. 检查包裹里面是否包含该装备equipId
		var equipItem = user.PackageManager.FindItem(equipId);
		if (equipItem === undefined)
			return callback("ItemNotInBackPack");

		// 2. 检查包裹里面是否包含强化石stoneId
		var stoneItem = user.PackageManager.FindItem(stoneId);
		if (stoneItem === undefined)
			return callback("ItemNotInBackPack");

		// 3. 检查装备的强化次数是否已经用完.
		var equipBase = global.EquipBaseTable.GetItem(equipItem.Base);
		if (equipBase === undefined || 
			equipBase.StrengthenCount === 0)
			return callback("ItemCanNotStrengthen");
			
		if (equipItem.Attrib.StrengthenCount >= equipBase.StrengthenCount)
			return callback("NotEnoughStrengthenCount");

		// 获取装备的强化属性名称
		// 比如武器就是强化攻击力（MainType:1, SubType:1, Attrib:'Damage')
		var equipItemBase = global.ItemBaseTable.GetItem(equipItem.Base);
		if (equipItemBase === undefined)
			return callback("ItemBaseNotFound");

		// 检测消耗金钱。[以装备的等级+强化石的类型来确定消耗。]
		var forgeGold = global.ForgeGoldTable.GetItem(equipItemBase.Level);
		if (forgeGold === undefined)
			return callback("ForgeGoldEntryNotFoundInTable");
		
		// 获取强化石的子类
		var stoneItemBase = global.ItemBaseTable.GetItem(stoneItem.Base);
		if (stoneItemBase.MainType !== ItemType_Stone)
			return callback("ItemTypeNotStone");
		
		// 获取该次强化所需要的金币。
		var costGold = forgeGold["ForgeGold" + stoneItemBase.SubType];
		if (costGold === undefined)
			return callback("ForgeGoldItemNotFoundInTable");
			
		// 检测金币是否够。
		if (user.Attrib.Gold < costGold)
			return callback("NotEnoughGold");
			
		// 强化的目标属性。
		var targetAttrib = global.TargetAttribTable.GetItem(equipItemBase.MainType, equipItemBase.SubType);
		if (targetAttrib === undefined)
			return callback("NoStrengthAttribFound");

		// 获取强化的属性表格，
		// 就是改强化石对各个属性的强化能力。
		// 比如一级强化石，强化攻击【1-5】，强化防御【10-15】，强化暴击...
		var forgeBase = global.ForgeBaseTable.GetItem(stoneItem.Base);
		if (forgeBase === undefined)
			return callback("StoneNotFoundForgeBase");

		// 获取到该强化石对指定属性的强化效果
		// 这里是一个数组，里面包含最小值和最大值。
		var forgeAttrib = forgeBase[targetAttrib.Attrib];
		if (forgeAttrib === undefined)
			return callback("ForgeAttribNotFound");

		// 随机一个强化属性出来。强化石现在是强化装备基础属性的百分比。
		var base = equipBase[targetAttrib.Attrib];
		var min = forgeAttrib[0] * base * 0.0001; // 百分比的基础为10000.
		var max = forgeAttrib[1] * base * 0.0001; // 百分比的基础为10000.
		var forgeValue = Math.floor(Math.random() * (max - min + 1) + min);

		// 4. 从包裹里面扣除强化石。
		if (!user.PackageManager.RemoveItem(stoneId, 1))
			return callback("RemoveItemFailed");

		// 5. 记录装备的已强化次数。
		if (equipItem.Attrib.StrengthenCount === undefined)
			equipItem.Attrib.StrengthenCount = 1;
		else
			equipItem.Attrib.StrengthenCount++;

		// 扣除金币数目。
		if (costGold > 0)
			user.AddGold(-costGold);

		// 强化成功100%, 添加强化属性值。
		var oldValue = (equipItem.Attrib[targetAttrib.Attrib] || 0);
		equipItem.Attrib[targetAttrib.Attrib] = oldValue + forgeValue;

		// 若改装备正在使用中，需要更新玩家的属性。
		if (equipItem.Attrib.Equip === Attrib_True)
			user.UpdateAttrib();

		callback(undefined, "StrengthenSuccess");

		// 记录消费
		global.RecordManager.Consume(user, "strengthen", equipItemBase.ID, equipItemBase.Name, 1, costGold, 0);
		
		console.LOG("物品强化: 玩家[%s] ID[%d] 物品[%d] 物品名称[%s] 强化石[%d] 强化石名[%d] 生成属性[%s] 属性值[%d] 强化次数[%d] 金币[%d]",
			user.Key(),
			equipId,
			equipItem.Base,
			equipItemBase.Name,
			stoneId,
			stoneItem.Base,
			targetAttrib.Attrib,
			forgeValue,
			equipItem.Attrib.StrengthenCount,
			costGold);
	}

	// 物品的使用。
	this.UseItem = function(user, id, callback) {
		// 1: 检测是否包含该消耗物品
		var propsItem = user.PackageManager.FindItem(id);
		if (propsItem === undefined)
			return callback("ItemNotInBackPack");

		// 2：物品的类型是否为消耗品
		var propsBase = global.PropsBaseTable.GetItem(propsItem.Base);
		if (propsBase === undefined)
			return callback("ItemIsNotProps");

		// 3：物品的使用限制
		if (user.Attrib.Level < propsBase.ReqLevel)
			return callback("LevelNotMatch");

		// 包裹已满，不支持提取物品的操作。
		//var hasItem = Array.isArray(propsBase.ItemID) && propsBase.ItemID.length > 0;
		//hasItem = hasItem || (Array.isArray(propsBase.DropGroups) && propsBase.DropGroups.length > 0);
		//if (hasItem && user.PackageManager.IsFull())
		//	return callback("BackPackageIsFull");

		// 4：物品使用的消耗
		user.PackageManager.RemoveItem(id, 1);

		// 5：物品使用的结果
		var ret = {};
		if (propsBase.Gold > 0) user.AddGold(ret.Gold = propsBase.Gold);
		if (propsBase.Gem > 0) user.AddGem(ret.Gem = propsBase.Gem);
		if (propsBase.Exp > 0) user.AddExp(ret.Exp = propsBase.Exp);
		if (propsBase.SP > 0) user.AddSP(ret.SP = propsBase.SP);
		if (propsBase.Strength > 0) user.AddStrength(ret.Strength = propsBase.Strength);
		
		// 生命值&魂值&职业值都是即时生效。服务器暂时不验证
		// HP & Soul & Ability
		if (Array.isArray(propsBase.ItemID) && propsBase.ItemID.length > 0) {
			for (var i in propsBase.ItemID) {
				var itemId = propsBase.ItemID[i];
				var itemBase = global.ItemBaseTable.GetItem(itemId);
				if (itemBase === undefined) continue; // 配置的掉落物品不存在。
				if (itemBase.Role > 0 && 
					itemBase.Role !== user.Attrib.Role) 
					continue; // 不是本职业的东西。
				user.PackageManager.AddItem(itemBase, 1);
				ret.Items = ret.Items || {};
				ret.Items[itemId] = (ret.Items[itemId] || 0) + 1;
			}
		}
		
		// 随机获得物品啥的～
		if (propsBase.DropCount > 0 &&
			Array.isArray(propsBase.DropGroups) && 
			propsBase.DropGroups.length > 0) {
			
			// 通过掉落组来配置～
			ret.Items = {};
			for (var dropCount = 0; dropCount < propsBase.DropCount; dropCount++) {
				for (var i in propsBase.DropGroups) {
					var dropGroup = propsBase.DropGroups[i];
					if (dropGroup === 0) continue;
					global.LevelManager.Drop(dropGroup, ret.Items, user);
				}
			}
			
			// 添加到玩家的包裹里面。
			for (var i in ret.Items)
				user.PackageManager.AddItem(parseInt(i), ret.Items[i]);
		}

		//callback(undefined, "UseItemSuccess");
		callback(undefined, ret);

		console.LOG("使用物品: 玩家[%s] ID[%d] 物品[%d] 名称[%s] 金币[%d] 钻石[%d] 经验[%d] 物品[%s]",
			user.Key(),
			id,
			propsItem.Base,
			propsBase.Name,
			propsBase.Gold,
			propsBase.Gem,
			propsBase.Exp,
			JSON.stringify(propsBase.ItemID));
	}
	
	this.EquipProps = function(user, id, slot,callback) {
		// 1: 检测是否包含该消耗物品
		var item = user.PackageManager.FindItem(id);
		if (item === undefined) {
			callback("ItemNotInBackPack");
			return;
		}
		
		// 2. 检测该物品是否已经装备了。
		if (item.Attrib.Slot === slot) {
			callback("ItemAlreadyEquiped");
			return;
		}

		// 3. 检测该物品能否被装备。
		var itemBase = global.ItemBaseTable.GetItem(item.Base);
		if (itemBase === undefined || itemBase.MainType !== ItemType_Props) {
			callback("ItemCanNotEquip");
			return;
		}
		
		// 4. 替换之前的消耗品。
		var backPack = user.PackageManager.BackPack();
		for (var i in backPack.Items) {
			var otherItem = backPack.Items[i];
			if (otherItem.Attrib.Slot === slot) {
				var otherItemBase = global.ItemBaseTable.GetItem(otherItem.Base);
				if (otherItemBase !== undefined && otherItemBase.MainType === ItemType_Props) {
					// 卸下这个装备。
					delete otherItem.Attrib.Slot;
					break;
				}
			}
		}
		
		item.Attrib.Slot = slot;

		callback(undefined, "EquipPropsSuccess");
		
		console.LOG("装备消耗品: 玩家[%s] 物品[%d] 名称[%s] 槽位[%d]",
			user.Key(),
			id,
			itemBase.Name,
			slot);
	}
}

// 物品的装备
// 参数是物品的id号
// 在ItemBase表内，只有ItemType_Equip类型的才能够被装备
// 通过SubType来替换之前的装备。
exports.Equip = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	var id = (params.id || 0);
	if (isNaN(id))
		return response.Error("InvalidParam");

	global.ItemManager.Equip(user, id, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

exports.UnEquip = function(service,params,connection,response) {
    var user = connection.user;
    if (user === undefined)
        return response.Error("UserNotLogin");

    var id = (params.id || 0);
    if (isNaN(id))
        return response.Error("InvalidParam");

    global.ItemManager.UnEquip(user,id,function(err,ret){
        if (err)
			response.Error(err);
        else
			response.Send(ret);
    });
}


// 物品的合并
exports.Combine = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.COMBINE)
		return response.Error("CombineDisabled");

	var id = (params.id || 0);
	var time = (params.time || 1);
	if (isNaN(id) || time < 1)
		return response.Error("InvalidParam");

	global.ItemManager.Combine(user, id, time, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 物品的强化
// 参数equip为被强化的物品id号
// 参数stone为强化石的物品id号
exports.Strengthen = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.FORGE)
		return response.Error("ForgeDisabled");
		
	var equip = (params.equip || 0);
	var stone = (params.stone || 0);
	if (isNaN(equip) || isNaN(stone))
		return response.Error("InvalidParam");

	global.ItemManager.Strengthen(user, equip, stone, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 物品的使用
exports.UseItem = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.USE)
		return response.Error("UseDisabled");
		
	var id = (params.id || 0);
	if (isNaN(id))
		return response.Error("InvalidParam");

	global.ItemManager.UseItem(user, id, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret, "UseItemData");
	});
}

 // 装备一个消耗品到槽上。
exports.EquipProps = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	var id = (params.id || 0);
	var slot = (params.slot || 0);
	if (isNaN(id) || isNaN(slot) || slot <= 0)
		return response.Error("InvalidParam");

	global.ItemManager.EquipProps(user, id, slot, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

