
global.GMManager.Register('/get', function(params, response) {
	var path = params.path;
	if (path === undefined)
		return response.simpleJSON({ error: "InvalidParams" });
		
	var names = path.split('.');
	if (names.length == 0)
		return response.simpleJSON({ error: "InvalidParams" });
		
	var target = global[names[0]];
	for (var i = 1; i < names.length; i++) {
		if (target === undefined) break;
		target = target[names[i]];
	}
	response.simpleJSON({ data: JSON.stringify(target) });
});

global.GMManager.Register('/set', function(params, response) {
	var path = params.path;
	var value = params.value;
	if (path === undefined || value === undefined)
		return response.simpleJSON({ error: "InvalidParams" });
		
	var names = path.split('.');
	if (names.length == 0)
		return response.simpleJSON({ error: "InvalidParams" });
		
	var target = global;
	for (var i = 0; i < names.length - 1; i++) {
		if (target === undefined) break;
		target = target[names[i]];
	}
	if (target === undefined)
		return response.simpleJSON({ error: "InvalidParams" });
		
	target[names[names.length - 1]] = JSON.parse(value);
	response.simpleJSON({ data: "SetSuccess!!!" });
});

