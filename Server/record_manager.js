
if (global.RecordManager === undefined) global.RecordManager = new function() {

	this.ensureIndex = function(db, table, key, unique) {
		// 名字必须唯一～！！！
		db.collection(table, function(err, collection) {
			var index = {};
			index[key] = 1;
			collection.ensureIndex(index, {unique: unique}, function(err) {
				if (err) console.LOG("ensureIndex failed:" + err);
			});
		});
	}
	
	this.Init = function(db) {
		this.ensureIndex(db, global.TABLES.USER, 'user', true);
		this.ensureIndex(db, global.TABLES.PAY, 'transaction_id', true);
		this.ensureIndex(db, global.TABLES.LOGIN, 'id', true);
	}
	
	// 消费
	this.Consume = function(user, type, itemId, itemName, itemCount, gold, gem, sp) {
		var record = {
			Time: new Date(),
			Type: type,
			User: user.Key(),
			Level: user.Attrib.Level,
			ItemId: itemId,
			ItemName: itemName,
			ItemCount: itemCount,
			Gold: gold,
			Gem: gem,
			SP: sp
		}
		this.Save(global.TABLES.CONSUME, record);
	}
	
	// 登录的信息记录。
	this.Login = function(user, time) {
		var account = user.connection.account;
		if (!account) return;
		
		Service.Database.collection(global.TABLES.LOGIN, function(err, collection) {
			if (err) return console.ERROR("记录数据打开出错：" + err);
			collection.findOne({id: account}, function(err, item) {
				if (item == null) item = {
					id: account,
					time: time,
					logins: [] };
				item.logins.push({
					user: user.Key(),
					time: time });
				collection.save(item, function(err, item) {
					if (err) console.ERROR("记录数据保存出错：" + err);
				});
			});
		});
	}
	
	// 保存记录
	this.Save = function(table, record) {
		global.Service.Database.collection(table, function(err, collection) {
			if (err) return console.ERROR("记录数据打开出错：" + err);
			collection.insert(record, function(err, item) {
				if (err) console.ERROR("记录数据插入出错：" + err);
			});
		});
	}
	
	// 查找数据库。
	this.findOne = function(table, query, callback) {
		global.Service.Database.collection(table, function(err, collection) {
			if (err || collection === undefined)
				return callback('DatabaseError');
				
			collection.findOne(query, callback);
		});
	}
}