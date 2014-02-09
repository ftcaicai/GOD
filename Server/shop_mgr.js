
var Util = require('util');

// 商店管理器。
if (global.ShopManager == null) global.ShopManager = new function() {

	// 列举商店里面所有的物品信息。
	this.List = function() {
	}

	// 向商店里面购买某一种道具。
	this.Buy = function(user, id, use, callback) {
		//if (user.PackageManager.IsFull())
		//	return callback("BackPackageIsFull");
			
		// 1. 检测商城是否具有该物品
		var shopItem = global.ShopBaseTable.GetItem(id);
		if (shopItem === undefined)
			return callback("ShopDoesNotContainItem"); // 错误，商店不存在该商品。
		
		// 2. 检测购买等级。
		if (user.Attrib.Level < shopItem.MinLevel ||
			user.Attrib.Level > shopItem.MaxLevel)
			return callback("LevelNotMatch"); // 错误，等级不够，不能购买该商品。
		
		// 3. 检测购买钻石&金币。
		var gold = shopItem.Gold;
		if (user.Attrib.Gold < gold)
			return callback("NotEnoughGold"); // 错误，金币不够。
		
		var gem = shopItem.Gem;
		if (user.Attrib.Gem < gem)
			return callback("NotEnoughGem"); // 错误，钻石不够。
			
		var sp = shopItem.SP;
		if (user.Attrib.SP < sp)
			return callback("NotEnoughSP"); // 错误，SP不够。
		
		// 4. 检测背包的空位是不是对的。
		
		// 5. 检测该商品是否存在。
		var itemBase = global.ItemBaseTable.GetItem(shopItem.Item);
		if (itemBase === undefined)
			return callback("ShopItemNotFoundInItemBase"); // 错误，该商店售出物品不存在。
		
		// 6. 检测职业限制。
		if (itemBase.Role != 0 && user.Attrib.Role != itemBase.Role)
			return callback("CannotByOtherRoleItem"); // 错误，不能购买非本职业商品。
		
		// 7. 扣款。
		if (gold > 0) user.AddGold(-gold);
		if (gem > 0) user.AddGem(-gem);
		if (sp > 0) user.AddSP(-sp);
		
		// 8. 添加物品到背包。
		var addedItem = user.PackageManager.AddItem(itemBase, shopItem.Count);
		
		// 9. (增加是否立即使用的接口。)
		if (addedItem && use){
			global.ItemManager.UseItem(user, addedItem.ID, function(err, useItemData) {
				if (err)
					callback("FailToUseItem");
				else
					callback(undefined, useItemData, "UseItemData");
			});
		}
		else {
			// 11. 购买成功。
			callback(undefined, "SuccessBuy");
		}
		
		// 记录消费
		global.RecordManager.Consume(user, "buy", itemBase.ID, itemBase.Name, shopItem.Count, gold, gem);
		
		console.LOG("购买物品: 玩家[%s] 商品[%d] 物品[%s] 个数[%d] 金币[%d] 钻石[%d]", 
			user.Key(), 
			id, 
			itemBase.Name, 
			shopItem.Count, 
			gold, 
			gem);
	}
	
	// 向商店售出某一种道具。
	this.Sell = function(user, id, callback) {
		// 1. 检测玩家是否具有该物品
		var backPack = user.PackageManager.BackPack();
		var item = backPack.Items[id];
		if (item === undefined)
			return callback("ItemNotInBackPack"); // 背包中不存在该物品。

		// 已经装备的物品不能够被售出。
		if (item.Attrib.Equip != undefined)
			return callback("ItemAlreadyEquiped");
		
		// 2. 检测该物品能否被出售。
		var itemBase = global.ItemBaseTable.GetItem(item.Base);
		if (itemBase === undefined || itemBase.SellType === 0)
			return callback("ItemCanNotSell"); // 该物品不能被出售。
		
		// 3. 从背包中删除该物品
		delete backPack.Items[id];
		
		// 4. 计算物品的价格，目前出售均为获得游戏币（金币）。
		var totalPrice = 0;
		if (itemBase != undefined && itemBase.SellPrice > 0)
			totalPrice = itemBase.SellPrice * item.Num;
			
		// 5. 计算装备强化的返还值。
		if (item.StrengthenCount > 0) {
			// 找出对应的强化数值。
			var equipBase = global.EquipBaseTable.GetItem(item.Base);
			var targetAttrib = global.TargetAttribTable.GetItem(itemBase.MainType, itemBase.SubType);
			if (equipBase !== undefined && targetAttrib !== undefined) {
				var finalValue = item.Attrib[targetAttrib.Attrib];
				var baseValue = equipBase[targetAttrib.Attrib];
				if (finalValue > 0 && baseValue > 0) {
					// 找出平均每次强化的数值。
					var averageValue = 10000 * finalValue / baseValue / item.StrengthenCount;
					for (var i = 1; i < 7; i++) {
						var forgeReturn = global.ForgeReturnTable.GetItem(itemBase.SubType, i);
						if (forgeReturn === undefined)
							break;
						if (averageValue < forgeReturn.Max) {
							// 根据次数来返还强化所需要的价格表。
							totalPrice += forgeReturn.Return * item.StrengthenCount;
							break;
						}
					}
				}
				else {
					console.ERROR("物品上找不到装备的强化属性：ID(%d) MainType(%d)SubType(%d)", 
						item.Base,
						itemBase.MainType, 
						itemBase.SubType);
				}
			}
			else {
				console.ERROR("表格上找不到装备的强化属性：ID(%d) MainType(%d)SubType(%d)", 
					item.Base,
					itemBase.MainType, 
					itemBase.SubType);
			}
		}
		
		// 6. 添加到玩家。
		if (totalPrice > 0)
			user.AddGold(totalPrice);
		
		// 7. 出售成功。
		callback(undefined, "SuccessSell");
		
		console.LOG("出售物品: 玩家[%s] 物品[%d] 名称[%s] 获得金币[%d]", 
			user.Key(), 
			id, 
			itemBase.Name, 
			totalPrice);
	}

	// 批量售出商品。
	this.BatchSell = function(user, ids, callback) {
		var backPack = user.PackageManager.BackPack();
		var totalPrice = 0;
		// 检测所售出的物品是否都符合条件。
		for (var i = 0; i < ids.length; i++) {
			var id = ids[i];
			var item = backPack.Items[id];
			if (item === undefined) {
				callback("ItemNotInBackPack"); // 背包中不存在该物品.
				return;
			}

			// 已经装备的物品不能够被售出。
			if (item.Attrib.Equip != undefined) {
				callback("ItemAlreadyEquiped");
				return;
			}

			var itemBase = global.ItemBaseTable.GetItem(item.Base);
			if (itemBase === undefined || itemBase.SellType === 0) {
				callback("ItemCanNotSell"); // 该物品不能被出售。
				return;
			}

			totalPrice += itemBase.SellPrice * item.Num;
		}

		// 所有的物品。
		for (var id in ids)

			user.PackageManager.RemoveItem(ids[id]);

		// 获得金币。
		user.AddGold(totalPrice);

		// 5. 出售成功。
		callback(undefined, "SuccessSell");

		console.LOG("批量售出: 玩家[%s] 物品[%s] 获得金币[%d]",
			user.Key(),
			JSON.stringify(ids),
			totalPrice);
	}
	
	// 充值。
	this.Recharge = function(user, info, callback) {
		if (info === undefined || info.status != 0)
			return callback("InvalidParam");
		
		var receipt = info.receipt;
		if (receipt === undefined ||
			receipt.quantity == undefined ||
			receipt.product_id == undefined ||
			receipt.transaction_id == undefined ||
			receipt.purchase_date == undefined)
			return callback("InvalidParam");
		
		// quantity, product_id, transaction_id, purchase_date, app_item_id, bid, bvrs
		// 1. 检查订单所对应交易是否已经存在【transaction_id】。
		global.Service.Database.collection(global.TABLES.PAY, function(err, collection) {
			if (err || collection === undefined) {
				console.ERROR("支付失败: 用户[%s] 支付信息[%s] 错误信息[%s]", 
					user.Key(), 
					JSON.stringify(receipt), 
					"数据库错误：" + err);
				return callback("DatabaseError");
			}
			
			// 检查订单是否已经存在。
			collection.findOne({transaction_id: receipt.transaction_id}, {_id: true}, function(err, item) {
				if (item != undefined) {
					console.ERROR("支付失败: 用户[%s] 支付信息[%s] 错误信息[%s]", 
						user.Key(), 
						JSON.stringify(receipt), 
						"订单已经处理");
					return callback("TransactionAlreadyExist");
				}
					
				// 2. 从表格从查找对应充值的金币。
				var rechargeBase = global.RechargeBaseTable.GetItem(receipt.product_id);
				if (rechargeBase === undefined) {
					console.ERROR("支付失败: 用户[%s] 支付信息[%s] 错误信息[%s]", 
						user.Key(), 
						JSON.stringify(receipt), 
						"商品未找到");
					return callback("ProductNotFound");
				}
				
				// 3. 添加必要字段。
				receipt.time = new Date();
				receipt.usd = rechargeBase.USD;
				receipt.gem = rechargeBase.Gem;
				receipt.gold = rechargeBase.Gold;
				receipt.user = user.Key();
				
				// 4. 记录进数据库。
				collection.insert(receipt, function(err, item) {
					if (err) {
						console.ERROR("支付失败: 用户[%s] 支付信息[%s] 错误信息[%s]", 
							user.Key(), 
							JSON.stringify(receipt), 
							"订单插入失败:" + err);
						return callback("DatabaseError");
					}
					
					// 5. 给予充值的东西。
					if (rechargeBase.Gem > 0) user.AddGem(rechargeBase.Gem);
					if (rechargeBase.Gold > 0) user.AddGold(rechargeBase.Gold);
					if (rechargeBase.Item > 0) user.PackageManager.AddItem(rechargeBase.Item, 1);

					// 6. 告诉玩家新的金币和钻石数量。
					var attrib = { Gold: user.Attrib.Gold, Gem: user.Attrib.Gem, SP: user.Attrib.SP };
					callback(undefined, attrib);
					
					// 7. 发送邮件告诉玩家充值成功。
					global.MailManager.SendSimple(
						global.TEXTS.SYSTEM_NAME, // sender
						user.Key(), // to
						global.TEXTS.RECHARGE_MAIL_TITAL, // title
						Util.format(global.TEXTS.RECHARGE_MAIL_CONTENT, rechargeBase.Gem)); // content
	
					console.LOG("支付成功: 用户[%s] 商品[%s] 花费[%d] 获得钻石[%d] 获得金币[%d] 支付信息[%s]", 
						user.Key(), 
						receipt.product_id,
						rechargeBase.USD,
						rechargeBase.Gem,
						rechargeBase.Gold,
						JSON.stringify(receipt));
				});
			});
		});
	}
}

// 玩家在商店里面购买物品。
// id为商店表格里面配置的商品id号
// 返回错误信息，或者成功
// 成功之后需要更新背包信息。
exports.Buy = function(service, params, connection,  response) {
	if (connection.user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.BUY)
		return response.Error("BuyDisabled");

	var user = connection.user;
	var id = (params.id || 0);
	global.ShopManager.Buy(user, id, params.use, function(err, ret, type) {
		if (err != undefined)
			response.Error(err);
		else
			response.Send(ret, type);
	});
}

// 玩家从背包中出售物品。
// 这里其实跟商店也没啥关系。
// 返回错误信息，或者成功
// 成功之后需要更新背包信息。
exports.Sell = function(service, params, connection,  response) {
	if (connection.user === undefined)
		return response.Error("UserNotLogin");
	
	if (!global.SWITCHES.SELL)
		return response.Error("SellDisabled");
	
	var user = connection.user;
	var id = (params.id || 0);
	global.ShopManager.Sell(user, id, function(err, ret) {
		if (err != undefined)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 批量售出物品
// 参数ids必须为数字数组
// 若数组中的id有错误【不存在或者不能售出】则操作失败
// 只有所有id合法的情况下才能够售出
// 目前售出能够获得金币
// 成功之后需要更新背包和人物信息。
exports.BatchSell = function(service, params, connection,  response) {
	if (connection.user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.SELL)
		return response.Error("SellDisabled");

	var user = connection.user;
	var ids = params.ids;
	if (!Array.isArray(ids) || ids.length == 0)
		return response.Error("InvalidParam");

	global.ShopManager.BatchSell(user, ids, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
	return true;
}

// 游戏内充值付费。
var http_help = require('./base/http_help');
exports.Recharge = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	if (params.receipt === undefined)
		return response.Error("InvalidParam");
	
	if (!global.SWITCHES.RECHARGE)
		return response.Error("RechargeDisabled");
		
	// 服务器转换为base64字符编码。
	var base64receipt = new Buffer(params.receipt).toString('base64');
	
	// 验证是否合法，用于购买的验证。目前仅支持IOS平台的itunes。
	http_help.HttpPost(
		global.ITUNES_SANDBOX ? 
		"https://sandbox.itunes.apple.com/verifyReceipt" : 
		"https://buy.itunes.apple.com/verifyReceipt",
		{'receipt-data': base64receipt },
		function(err, res_data) {
			if (err) {
				console.LOG("支付失败：" + err);
				return response.Error(err);
			}

			var info = undefined;
			try {
				info = JSON.parse(res_data);
			}
			catch (e) {
				return response.Error("ReciptDataError");
			}
			global.ShopManager.Recharge(user, info, function(err, data) {
				if (err)
					response.Error(err);
				else
					response.Send(data, "MainAttrib");
			});
		}
	);
}

// 钻石兑换金币啥的.
exports.Exchange = function(service, params, connection,  response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	if (params.product === undefined)
		return response.Error("InvalidParam");
	
	if (!global.SWITCHES.EXCHANGE)
		return response.Error("ExchangeDisabled");
		
	var rechargeBase = global.RechargeBaseTable.GetItem(params.product);
	if (rechargeBase === undefined)
		return response.Error("TableNotFound");
		
	if (isNaN(rechargeBase.Gem) || rechargeBase.Gem >= 0)
		return response.Error("InvalidTableData");
	
	var costGem = -rechargeBase.Gem;
	if (user.Attrib.Gem < costGem)
		return response.Error("NotEnoughGem");
	
	user.AddGem(-costGem);
	user.AddGold(rechargeBase.Gold);
	
	var attrib = { Gold: user.Attrib.Gold, Gem: user.Attrib.Gem, SP: user.Attrib.SP };
	response.Send(attrib, "MainAttrib");

	// 记录消费
	global.RecordManager.Consume(user, "exchange", 0, params.product, 1, 0, rechargeBase.Gem);
	
	console.LOG("兑换成功: 用户[%s] 商品[%s] 消耗钻石[%d] 获得金币[%d]", 
		user.Key(), 
		params.product,
		costGem,
		rechargeBase.Gold);
}
