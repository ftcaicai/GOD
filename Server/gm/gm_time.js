
global.GMManager.Register('/time', function(params, response) {
	var now = new Date();
	response.simpleJSON({ data: now.getTime() });
});
