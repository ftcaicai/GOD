
// gm登录。
global.GMManager.Register('/login', function(params, response) {
	var account = params.account;
	var passwd = params.passwd;
	global.Service.Database.collection("gm_user", function(err, collection) {
		if (err)
			return response.simpleJSON({ error: 'DatabaseError: ' + err});
		
		collection.findOne({account: account, passwd: passwd}, {_id: true}, function(err, item) {
			if (item == null)
				return response.simpleJSON({ error: 'UserNotFound Or Invalid Password'});
			
			response.simpleJSON({ data: 'LoginSucess'});
		});
	});
});

// 添加一个gm用户，需要指定gm的参数。
global.GMManager.Register('/add_gm', function(params, response) {
	var name = params.name;
	var account = params.account;
	var passwd = params.passwd;
	var email = params.email;
	var admin = params.admin;
	
	global.Service.Database.collection("gm_user", function(err, collection) {
		if (err)
			return response.simpleJSON({ error: 'DatabaseError: ' + err});
		
		// 帐号必须唯一。
		if (collection != null) {
			collection.ensureIndex({account: 1}, {unique: true}, function(err) {
				if (err) console.LOG("ensureIndex failed: " + err);
			});
		}

		var item = {
			name: name,
			account: account,
			passwd: passwd,
			email: email,
			admin: admin,
			permission: 0,
			time: new Date(),
		};
		collection.insert(item, function(err) {
			if (err)
				response.simpleJSON({ error: 'DatabaseError: ' + err});
			else
				response.simpleJSON({ data: 'Success' });
		});
	});
});

// 删除指定的gm用户。
global.GMManager.Register('/delete_gm', function(params, response) {
	var account = params.account;
	global.Service.Database.collection("gm_user", function(err, collection) {
		if (err)
			return response.simpleJSON({ error: 'DatabaseError: ' + err});

		collection.remove({account: account}, function(err, count) {
			if (err)
				response.simpleJSON({ error: 'DatabaseError: ' + err});
			else
				response.simpleJSON({ data: 'Success' });
		});
	});
});

// 列举所有的gm用户。
global.GMManager.Register('/list_gm', function(params, response) {
	global.Service.Database.collection("gm_user", function(err, collection) {
		if (err)
			return response.simpleJSON({ error: 'DatabaseError: ' + err});

		collection.find().toArray(function(err, docs){
			if (err)
				response.simpleJSON({ error: 'DatabaseError: ' + err});
			else
				response.simpleJSON({ data: docs});
		});
	});
});