// item main type.
const ItemType_Equip = 1;
const ItemType_Rune = 2;
const ItemType_Stone = 3;
const ItemType_Props = 4;
const ItemType_Skill = 5;

// 包裹管理器，挂在user下面。
//	包裹管理器包含若干个包裹，比如常用的背包。
/*	其数据结构类似于：
	Packages = {
		BackPack: {
			IdBase: 12348,
			Items: {
				"12344": { ID: 12344, Base: 11003, Num: 1, Attrib: { ... } }
				"12345": { ID: 12345, Base: 11003, Num: 1, Attrib: { ... } }
				"12346": { ID: 12346, Base: 11003, Num: 1, Attrib: { ... } }
				"12347": { ID: 12347, Base: 11003, Num: 1, Attrib: { ... } }
				"12348": { ID: 12348, Base: 11003, Num: 1, Attrib: { ... } }
			},
		},
		SkillPack: {
			Items: {
				"12344": { ID: 12344, Base: 11003, Num: 1, Attrib: { ... } }
				"12345": { ID: 12345, Base: 11003, Num: 1, Attrib: { ... } }
				"12346": { ID: 12346, Base: 11003, Num: 1, Attrib: { ... } }
				"12347": { ID: 12347, Base: 11003, Num: 1, Attrib: { ... } }
				"12348": { ID: 12348, Base: 11003, Num: 1, Attrib: { ... } }
			},
		},
	};
*/
function PackageManager(user) {
	this.Owner = user;
	this.Packages = null; // it will init with LOAD.
	
	// 链接包裹管理器。
	user.PackageManager = this;
}

// 从数据库里面加载来的数据。
PackageManager.prototype.Load = function(packages) {
	this.Packages = packages;
	
	// if there is no skill package exist, init with table data.
	if (this.Packages.SkillPack.Items === undefined)
		global.SkillManager.Init(this.Owner);
}

// 装备上能够修正的属性值。
var EquipAttribNames = {
	'Damage': true, 
	'HPMax': true, 
	'Defense': true, 
	'SpecialDamage': true, 
	'SpecialDefense': true, 
	'Hit': true, 
	'Block': true, 
	'Tough': true, 
	'Critical': true};
// 为装备生成额外属性。
function BuildExtraAttrib(attrib, itemBase) {
	var equipBase = global.EquipBaseTable.GetItem(itemBase.ID);
	if (equipBase === undefined || !Array.isArray(equipBase.ExtraAttrib))
		return;
	
	// 随机属性。
	var existAttrib = {};
	for (var i in equipBase.ExtraAttrib) {
		var extraId = equipBase.ExtraAttrib[i];
		
		// 总概率是【0-1000】。
		var buildAttribId = 0;
		var backupAttrib = undefined;
		var backupAttribId = 0;
		var chance = Math.floor(Math.random() * 1001);
		for (var sequence = 1; sequence < 20; sequence++) {
			var entryId = (extraId << 16) + sequence;
			var extraAttrib = global.ExtraAttribTable.GetItem(entryId);
			if (extraAttrib === undefined) break;
			if (existAttrib[extraAttrib.Attrib] === undefined) {
				if (chance < extraAttrib.Chance) {
					buildAttribId = entryId;
					existAttrib[extraAttrib.Attrib] = 1;
					break;
				}
				backupAttribId = entryId;
				backupAttrib = extraAttrib;
			}
			chance -= extraAttrib.Chance;
		}
		
		// 额外属性未找到的情况下，检查是否有备选方案。
		if (buildAttribId == 0 && backupAttrib !== undefined) {
			buildAttribId = backupAttribId;
			existAttrib[backupAttrib.Attrib] = 1;
		}
		
		// 记录额外属性进去。
		if (buildAttribId > 0) {
			var extraNum = Object.keys(existAttrib).length;
			if (extraNum > 0) attrib['Extra' + extraNum] = buildAttribId;
		}
	}
}
 // 生成额外属性，叠加到玩家属性上。
function GenerateExtraAttrib(userAttrib, extraId) {
	var extraAttrib = global.ExtraAttribTable.GetItem(extraId);
	if (extraAttrib === undefined || !EquipAttribNames[extraAttrib.Attrib])
		return;
	userAttrib[extraAttrib.Attrib] += extraAttrib.Value;
}

// 将装备上的属性值叠加到玩家身上去。
PackageManager.prototype.UpdateAttrib = function() {
	var itemList = this.Packages.BackPack.Items;
	var userAttrib = this.Owner.Attrib;
	for (var i in itemList) {
		var item = itemList[i];
		if (!item.Attrib.Equip)
			continue;
			
		// 获取装备基础属性。
		var equipBase = global.EquipBaseTable.GetItem(item.Base);
		if (equipBase === undefined)
			continue;

		// 添加此装备的基础属性。
		for (var i in EquipAttribNames) {
			var equipAttrib = equipBase[i];
			if (equipAttrib !== undefined && equipAttrib !== 0)
				userAttrib[i] += equipAttrib;
		}
		
		// 其他属性，如强化得来的。
		for (var i in item.Attrib) {
			if (i === 'Extra1' || i === 'Extra2' || i === 'Extra3')
				GenerateExtraAttrib(userAttrib, item.Attrib[i]);
			else if (EquipAttribNames[i])
				userAttrib[i] += item.Attrib[i];
		}
	}
}

// 填充玩家包裹信息到dta里面，发送到客户端。
// onlyEquip表明仅仅需要装备的信息就可以了，用于显示其他玩家。
PackageManager.prototype.Fill = function(data, onlyEquip) {
	if (onlyEquip) {
		// just need the [Equip] items.
		var equipdItems = {};
		var itemList = this.Packages.BackPack.Items;
		for (var i in itemList) {
			var item = itemList[i];
			if (item.Attrib.Equip)
				equipdItems[i] = item;
		}
		
		// fill the data.
		data.Packages = {
			BackPack: { Items: equipdItems },
			// we do not need the [SkillPack]
		};
	}
	else {
		// fill all [Packages] data to data.
		data.Packages = this.Packages;		
	}
}

// 从包裹中获取物品。
PackageManager.prototype.FindItem = function(id) {
	var backPack = this.Packages.BackPack;
	var itemList = backPack.Items;
	return itemList[id];
}

// 从包裹中获取指定物品类型的物品。
PackageManager.prototype.FindByBaseId = function(id) {
	var backPack = this.Packages.BackPack;
	var itemList = backPack.Items;
	for (var i in itemList) {
		var item = itemList[i];
		if (item.Base === id)
			return item;
	}
	return undefined;
}

// 从包裹中删除物品。
// id为物品的唯一id号
// count为个数，若个数不足则删除失败，0和空将全部删除。
PackageManager.prototype.RemoveItem = function(id, count) {
	var backPack = this.Packages.BackPack;
	var item = backPack.Items[id];
	if (item === undefined)
		return false;

	// count为空或者0，将全部删除。
	count = count || item.Num;

	if (item.Num < count)
		return false;

	if (item.Num === count)
		delete backPack.Items[id];
	else
		item.Num -= count;

	this.Owner.Dirty("Packages");
	return true;
}

// 添加物品到包裹[默认是背包]
// itemBase可以是id号，也可以是itemBase。
// 如果是itemBase，则省略从itemBase表格里面再次查询。
PackageManager.prototype.AddItem = function(itemBase, count) {
	// 若itemBase是数字类型，则认为是id号，从表格里面查询。
	if ('number' === typeof itemBase)
		itemBase = global.ItemBaseTable.GetItem(itemBase);
	
	// 对应的物品不存在。
	if (itemBase == null || count <= 0)
		return false;
	
	var addedItem = undefined;
	
	// 检查背包里面的物品的叠加属性，可以叠加的物品需要叠加。
	var backPack = this.Packages.BackPack;
	var itemList = backPack.Items;
	if (itemBase.OverlapLimit > 1) {
		for (var i in itemList) {
			var item = itemList[i];
			// 这个地方还可以放进去。
			if (item.Base === itemBase.ID && item.Num < itemBase.OverlapLimit) {
				var emptyNum = itemBase.OverlapLimit - item.Num;
				addedItem = item;
				if (emptyNum >= count) {
					item.Num += count;
					count = 0;
					break;
				}
				else {
					item.Num += emptyNum;
					count -= emptyNum;
				}
			}
		}
	}
	
	// 需要新开一个item来存放东西了。
	while (count > 0) {
		var newId = ++backPack.IdBase;
		var num = Math.min(count, Math.max(1, itemBase.OverlapLimit));
		var attrib = {};
		
		// 该物品是装备的话，需要检测是否能够生成额外属性。
		if (itemBase.MainType === ItemType_Equip)
			BuildExtraAttrib(attrib, itemBase);
		
		// 新加一个装备。
		addedItem = {
			ID: newId,
			Base: itemBase.ID,
			Num: num,
			Attrib: attrib,
		};
		itemList[newId] = addedItem;
		count -= num;
	}
	
	this.Owner.Dirty("Packages");
	return addedItem;
}

// 判断背包是否已经满了
PackageManager.prototype.IsFull = function() {
	var backPack = this.Packages.BackPack;
	var pageNum = (backPack.Pages || global.DEFAULT_BACKPACK_PAGE);
	var maxItemNum = pageNum * global.ITEMS_NUM_PER_PAGE;
	return Object.keys(backPack.Items).length >= maxItemNum;
}

// 购买背包的页数。
PackageManager.prototype.BuyPage = function(callback) {
	var backPack = this.Packages.BackPack;
	var newPages = (backPack.Pages || global.DEFAULT_BACKPACK_PAGE) + 1;
	
	var pageInfo = global.PackagePageTable.GetItem(newPages);
	if (pageInfo === undefined)
		return callback("CanotBuyMorePages");
	
	if (this.Owner.Attrib.Gold < pageInfo.Gold)
		return callback("NotEnoughGold");
	
	if (this.Owner.Attrib.Gem < pageInfo.Gem)
		return callback("NotEnoughGem");
	
	if (pageInfo.Gold > 0) this.Owner.AddGold(-pageInfo.Gold);
	if (pageInfo.Gem > 0) this.Owner.AddGem(-pageInfo.Gem);
	
	// 记录消费
	global.RecordManager.Consume(this.Owner, "package_page", 0, "package", newPages, pageInfo.Gold, pageInfo.Gem);
		
	backPack.Pages = newPages;
	this.Owner.Dirty("Packages");
	
	callback(undefined, "BuyPageSuccess");
}

PackageManager.prototype.BackPack = function() {
	return this.Packages.BackPack;
}

PackageManager.prototype.SkillPack = function() {
	return this.Packages.SkillPack;
}

// 获取到玩家的背包信息。
exports.GetUserBackPack = function(service, params, connection,  response) {
	if (connection.user === undefined)
		return response.Error("UserNotLogin");
		
	var user = connection.user;
	var packageMgr = user.PackageManager;
	var backPack = packageMgr.Packages.BackPack;
	response.Send(backPack, "Package");
}

// 获取到玩家的技能信息
exports.GetUserSkillPack = function(service, params, connection,  response) {
	if (connection.user === undefined)
		return response.Error("UserNotLogin");
		
	var user = connection.user;
	var packageMgr = user.PackageManager;
	var skillPack = packageMgr.Packages.SkillPack;
	response.Send(skillPack, "Package");
}

// 购买背包的额外页数
exports.BuyPackagePage = function(service, params, connection,  response) {
	if (connection.user === undefined) 
		return response.Error("UserNotLogin");
		
	var user = connection.user;
	var packageMgr = user.PackageManager;
	packageMgr.BuyPage(function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

exports.PackageManager = PackageManager;
