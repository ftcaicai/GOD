
// 排行榜的管理
//	排行榜的管理器，包含等级排行，战力排行等
//	都从数据库里面获取，大约5分钟更新一次。
if (global.TopListManager == null) global.TopListManager = new function() {
	var mTopList = {
		'level': { 
			field: { 
				_id: false, 
				'Attrib.Name': true, 
				'Attrib.Role': true, 
				'Attrib.Level': true,
				'Attrib.CurExp': true,
			},
			sort: { 'Attrib.Level': -1, 'Attrib.CurExp': -1 },
		},
		'money': { 
			field: { 
				_id: false, 
				'Attrib.Name': true, 
				'Attrib.Role': true, 
				'Attrib.Level': true,
				'Attrib.TotalGold': true,
			},
			sort: { 'Attrib.TotalGold': -1 },
		},
		'battle': { 
			field: { 
				_id: false,
				'Attrib.Name': true, 
				'Attrib.Role': true, 
				'Attrib.Level': true,
				'Attrib.Battle': true,
			},
			sort: { 'Attrib.Battle': -1 },
		},
		'progress': { 
			field: { 
				_id: false,
				'Attrib.Name': true, 
				'Attrib.Role': true, 
				'Attrib.Level': true,
				'Attrib.Progress': true,
			},
			sort: { 'Attrib.Progress': -1 },
		},
		'pvp': { 
			field: { 
				_id: false,
				'Attrib.Name': true, 
				'Attrib.Role': true, 
				'Attrib.Level': true,
				'Attrib.PvpLevel': true,
				'Attrib.PvpExp': true,
			},
			sort: { 'Attrib.PvpExp': -1 },
		},
	};
	
	this.LoadListFromDb = function(listInfo) {
		global.Service.Database.collection(global.TABLES.USER, function(err, collection) {
			if (collection == null) {
				console.LOG("database error TopListManager.LoadFromDb");
				return;
			}
			
			collection.find(
				{ deleted: {$exists: false} }, // 已删除玩家不进入排行榜
				listInfo.field, // 显示条件
				{limit: global.MAX_TOPLIST_NUM, sort: listInfo.sort}).toArray(function(err, docs) {
				// 获取一下列表
				listInfo.list = docs;
				if (Array.isArray(listInfo.list)) {
					// 生成一下排名列表，便于查询
					listInfo.rank = {};
					for (var i = 0; i < listInfo.list.length; i++) {
						var key = listInfo.list[i].Attrib.Name;
						listInfo.rank[key] = i + 1;
					}
				}
			});
		});
	}
	
	this.LoadFromDb = function() {
		for (var i in mTopList) {
			var listInfo = mTopList[i];
			global.TopListManager.LoadListFromDb(listInfo);
		}
	}
	
	// 获取排行榜的数据。
	this.GetTopList = function(user, type, page, size) {
		var listInfo = mTopList[type];
		if (listInfo === undefined || listInfo.list == null)
			return null;

		// 计算一下该玩家的名次。
		var key = user.Key();
		var ret = {
			page: page,
			rank: (listInfo.rank[key] || -1),
			total: listInfo.list.length,
			list: listInfo.list.slice(page * size, (page + 1) * size),
		};
		return ret;
	}
	
	setInterval(this.LoadFromDb, global.UPDATE_TOPLIST_TIME);
}

// 获取到排行榜的数据。
// 参数type需要为一下3情况：
// level: 等级&经验排行
// money：金币&游戏币排行
// battle：战力排行
exports.GetTopList = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error('UserNotLogin');

	if (!global.SWITCHES.TOPLIST)
		return response.Error('TopListDisabled');
		
	var type = params.type;
	var page = (params.page || 0);
	var size = (params.size || 0);
	if (type === undefined || isNaN(page) || isNaN(size))
		return response.Error('InvalidParam');

	var list = global.TopListManager.GetTopList(user, type, page, size);
	response.Send(list, "GetTopListResponse");
}



