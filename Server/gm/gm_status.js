
global.GMManager.Register('/status', function(params, response) {
	var status = global.Status;
	status.TOTAL_SOCKET_RECEIVED = global.TOTAL_SOCKET_RECEIVED;
	status.TOTAL_SOCKET_SENDED = global.TOTAL_SOCKET_SENDED;
	status.Time = new Date();
	response.simpleJSON({ data: status });
});
