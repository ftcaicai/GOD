
global.GMManager.Register('/user_data', function(params, response) {
	var user = params.user;
	var filter = {_id: true};
	if (params.filter !== undefined) {
		var fields = params.filter.split('.');
		for (var i in fields) filter[fields[i]] = true;
	}
	
	global.Service.Database.collection(global.TABLES.USER, function(err, collection) {
		if (err || collection === undefined)
			return callback('DatabaseError');
			
		collection.findOne({user: user}, filter, function(err, item) {
			response.simpleJSON({ error: err, data: item});
		});
	});
});

global.GMManager.Register('/online_user', function(params, response) {
	var cityIdx = parseInt(params.city || '0');
	
	var ret = {
		City: cityIdx,
		Users: [],
		CityNum: global.CityManager.GetCityNum(),
		UserNum: global.UserManager.GetUserNum() };
		
	var city = global.CityManager.GetCity(cityIdx);
	if (city != null) city.Foreach(function(user) {
		ret.Users.push({
			Name: user.Key(),
			Role: user.Attrib.Role,
			Level: user.Attrib.Level,
			IP: user.LoginInfo.LastLoginIp,
		});
	});
	response.simpleJSON({ data: ret});
});
