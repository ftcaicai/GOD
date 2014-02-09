
// gm查询消费的接口。
global.GMManager.Register('/consume', function(params, response) {
	if (params.user === undefined ||
		params.begin === undefined ||
		params.end === undefined)
		return response.simpleJSON({ error: 'InvalidParams'});
	
	var begin = new Date(parseInt(params.begin));
	var end = new Date(parseInt(params.end));
	global.Service.Database.collection("consume", function(err, collection) {
		if (err) return response.simpleJSON({ error: 'DatabaseError:' + err});
		
		var query = {
			User: params.user,
			Time: {$gte: begin, $lte: end} };
		collection.find(query, {_id: false}).toArray(function(err, docs){
			if (err)
				response.simpleJSON({ error: 'DatabaseError: ' + err});
			else
				response.simpleJSON({ data: docs});
		});
	});
});

// gm查询充值的接口。
global.GMManager.Register('/pay', function(params, response) {
	if (params.begin === undefined ||
		params.end === undefined)
		return response.simpleJSON({ error: 'InvalidParams'});
	
	var begin = new Date(parseInt(params.begin));
	var end = new Date(parseInt(params.end));
	global.Service.Database.collection(global.TABLES.PAY, function(err, collection) {
		if (err) return response.simpleJSON({ error: 'DatabaseError:' + err});
		
		var query = {time: {$gte: begin, $lte: end} };
		if (params.user !== undefined) query.user = params.user;
		collection.find(query, {_id: false}).toArray(function(err, docs){
			if (err)
				response.simpleJSON({ error: 'DatabaseError: ' + err});
			else
				response.simpleJSON({ data: docs});
		});
	});
});

// gm查询【新增用户】的接口。参数为某一个时间段【begin, end】。
global.GMManager.Register('/get_new_account', function(params, response) {
	if (params.begin === undefined ||
		params.end === undefined)
		return response.simpleJSON({ error: 'InvalidParams'});
	
	var begin = new Date(parseInt(params.begin));
	var end = new Date(parseInt(params.end));
	global.Service.Database.collection(global.TABLES.LOGIN, function(err, collection) {
		if (err) return response.simpleJSON({ error: 'DatabaseError:' + err});
		var query = {time: {$gte: begin, $lte: end} };
		collection.count(query, function(err, count){
			if (err) return response.simpleJSON({ error: 'DatabaseError:' + err});
			response.simpleJSON({ data: count});
		});
	});
});

// 需要计算的一些常量。
const TICKS_PER_DAY = 24 * 60 * 60 * 1000; // 一天有多少毫秒。
const MAX_RETAIN_DAY = 30; // 最多统计30天的留存。

// gm查询【用户留存】的接口。参数为某一个时间段【begin, end】。
global.GMManager.Register('/get_retain', function(params, response) {
	if (params.begin === undefined ||
		params.end === undefined)
		return response.simpleJSON({ error: 'InvalidParams'});
	
	var begin = new Date(parseInt(params.begin));
	var end = new Date(parseInt(params.end));
	global.Service.Database.collection(global.TABLES.LOGIN, function(err, collection) {
		if (err) return response.simpleJSON({ error: 'DatabaseError:' + err});
		var query = {time: {$gte: begin, $lte: end} };
		collection.find(query, {_id: false}).toArray(function(err, docs){
			if (err) return response.simpleJSON({ error: 'DatabaseError:' + err});
			var ret = [docs.length];
			for (var i in docs) {
				var account = docs[i];
				if (!account || !account.logins || account.logins.length <= 1) 
					continue;
				// 计算玩家第二次登录的时间。
				var createdDay = Math.floor(account.time.getTime() / TICKS_PER_DAY);
				var loginDay = Math.floor(account.logins[1].time.getTime() / TICKS_PER_DAY);
				var retain = loginDay - createdDay;
				if (retain > 0 && retain < MAX_RETAIN_DAY)
					ret[retain] = (ret[retain] || 0) + 1;
			}
			response.simpleJSON({ data: ret });
		});
	});
});
