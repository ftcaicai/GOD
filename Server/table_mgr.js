
var fs = require('fs');

function IsNumeric(input){
    var RE = /^-{0,1}\d*\.{0,1}\d+$/;
    return (RE.test(input));
}

function LoadFromFile(fileName, cb) {
	//console.log("LoadFromFile:" + fileName);
	var fileData = fs.readFileSync(fileName, "ucs2");
	var lines = fileData.replace(/[\r]/g, '').split('\n');
	var varNames = lines[1].split('\t');
			
	for (var i = 2; i < lines.length; i++) {
		var values = lines[i].split('\t');
		if (values.length === 1)
			break;

		if (varNames.length != values.length) {
			cb("parse error, columne number not match: " + values.length);
			continue;
		}

		var item = {};
		for (var j = 0; j < values.length; j++) {
			var value = values[j];
			if (IsNumeric(value))
				value = parseInt(value);
			item[varNames[j]] = value;
		}
		cb(null, item);
	}
}

// helper functions.
function IdKeyFunc(item) { return item.ID; }
function DoubleKey(key1, key2) { return (key1 << 16) + key2; }

// 将字符串转换为数字数组，分割字符默认为|
function StringToNumArray(str, flag) {
	// 若本身为数字，则返回单一的数组。
	if ('number' === typeof(str)) return [str];
	if (str === undefined) return [];

	flag = (flag || '|');
	var ret = [];
	var values = str.split(flag);
	for (var i = 0; i < values.length; i++)
		ret.push(parseInt(values[i]));
	return ret;
}

function TableManager(fileName, keyFunc) {
	this.mItemArray = {};
	
	this.GetItem = function(key1, key2) {
		if (key2 !== undefined) return this.mItemArray[DoubleKey(key1, key2)]; 
		return this.mItemArray[key1]; 
	}
	this.GetAllItem = function() { return this.mItemArray; }
	
	// build the table manager from array.
	keyFunc = keyFunc || IdKeyFunc;
	
	var self = this;
	LoadFromFile(fileName, function(err, item) {
		if (err != null) {
			console.error("TableManager load failed: " + err);
			return;
		}
		var key = keyFunc(item);
		if (key === undefined || key === "") {
			console.error("TableManager load failed, invalid key:" + fileName);
			return;
		}
		
		self.mItemArray[key] = item;
	});
}

// PlayerAttribTable
exports.Load = function() {
	// 一个键的表格
	global.ItemBaseTable = new TableManager("./tables/ItemBase.txt");
	global.ShopBaseTable = new TableManager("./tables/ShopBase.txt");
	global.CombineBaseTable = new TableManager("./tables/CombineBase.txt");
	global.SkillBaseTable = new TableManager("./tables/SkillBase.txt");
	global.PackagePageTable = new TableManager("./tables/PackagePage.txt");
	global.RuneBaseTable = new TableManager("./tables/RuneBase.txt");
	global.ReviveBaseTable = new TableManager("./tables/ReviveBase.txt");
	global.PvpBaseTable = new TableManager("./tables/PvpBase.txt");
	global.StrengthBaseTable = new TableManager("./tables/StrengthBase.txt");
	global.ForgeGoldTable = new TableManager("./tables/ForgeGold.txt");
	global.RechargeBaseTable = new TableManager("./tables/RechargeBase.txt", 
			function(item) { return item.ProductID; } );
	global.BattleBaseTable = new TableManager("./tables/BattleBase.txt",
			function(item) { return item.Attrib; });

	// 多个键的表格
	global.PlayerAttribTable = new TableManager("./tables/PlayerAttrib.txt",  
			function(item) { return DoubleKey(item.ID, item.Level); } );
	global.SkillAttribTable = new TableManager("./tables/SkillAttrib.txt", 
			function(item) { return DoubleKey(item.ID, item.Level); } );
	global.TargetAttribTable = new TableManager("./tables/TargetAttrib.txt", 
			function(item) { return DoubleKey(item.MainType, item.SubType); } );
	global.DefaultPlayerEquipTable = new TableManager("./tables/DefaultPlayerEquip.txt", 
			function(item) { return DoubleKey(item.Role, item.Index); } );
	global.PvpBalanceTable = new TableManager("./tables/PvpBalance.txt", 
			function(item) { return DoubleKey(item.ID, item.Level); } );
	global.ForgeReturnTable = new TableManager("./tables/ForgeReturn.txt", 
			function(item) { return DoubleKey(item.SubType, item.Index); } );
	global.ExtraAttribTable = new TableManager("./tables/ExtraAttrib.txt", 
			function(item) { return DoubleKey(item.ID, item.Sequence);  });
	global.MonsterAttribTable = new TableManager("./tables/MonsterAttrib.txt", 
			function(item) { return DoubleKey(item.ID, item.Level); });

	// 复杂处理的表格。
	// 关卡表里面的掉落组。
	global.LevelSetTable = new TableManager("./tables/LevelSetup.txt", function(item) {
		item.NormalDrop = StringToNumArray(item.NormalDrop);
		item.GeniusDrop = StringToNumArray(item.GeniusDrop);
		item.BossDrop = StringToNumArray(item.BossDrop);
		item.ExtraDrop = StringToNumArray(item.ExtraDrop);
		item.TurntableGroups = StringToNumArray(item.TurntableGroups);
		return item.ID;
	});
	
	global.DropGroupTable = new TableManager("./tables/DropGroup.txt", function(item) { 
		item.Items = StringToNumArray(item.Items);
		return DoubleKey(item.ID, item.Sequence); 
	} );
	
	// 任务表格里面的配置物品是比较复杂一点点。
	global.QuestBaseTable = new TableManager("./tables/QuestBase.txt", function(item) {
		item.Items = StringToNumArray(item.Items);
		return item.ID;
	});
	
	global.SignInBaseTable = new TableManager("./tables/SignInBase.txt", function(item) {
		item.Items = StringToNumArray(item.Items);
		return item.ID;
	});

	global.EquipBaseTable = new TableManager("./tables/EquipBase.txt", function(item) {
		item.ExtraAttrib = StringToNumArray(item.ExtraAttrib);
		return item.ID;
	});
	
	// 消耗品表格，解析物品（如礼包）数据。
	global.PropsBaseTable = new TableManager("./tables/PropsBase.txt", function(item) {
		item.ItemID = StringToNumArray(item.ItemID);
		item.DropGroups = StringToNumArray(item.DropGroups);
		return item.ID;
	});

	// 强化表里面属性配置是最大值最小值，中间加|来配置的，加载的时候需要处理。
	global.ForgeBaseTable = new TableManager("./tables/ForgeBase.txt", function(item) {
		for (var i in item) {
			if ('string' === typeof(item[i]))
				item[i] = StringToNumArray(item[i]);
		}
		return item.ID;
	});
}
