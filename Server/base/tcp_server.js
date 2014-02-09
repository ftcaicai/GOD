
var EventEmitter = require('events').EventEmitter;
var Util = require('util');
var Net = require('net');
var TcpConnection = require('./tcp_connection');

function TcpServer() {
	this.Server = undefined;
    this.connections = [];
	this.disconnected = [];
}

Util.inherits(TcpServer, EventEmitter);

// UDP服务器初始化。
TcpServer.prototype.init = function() {
	this.Server = Net.createServer(this.onConnection.bind(this));
}

// 开始监听。
TcpServer.prototype.listen = function(port) {
	this.Server.listen(port);
}

TcpServer.prototype.onConnection = function(socket) {
	this.emit('request', socket);
}

TcpServer.prototype.accept = function(socket) {
	var self = this;
	
	var connection = new TcpConnection(this, socket);
	connection.once('close', function() {
		self.onClose(connection);
	});
	
	// fetch from the disconnected pool.
	var index = this.connections.length;
	if (this.disconnected.length > 0) {
		var idx = this.disconnected.pop();
		if (idx < this.connections.length && this.connections[idx] == null)
			index = idx;
	}
	this.connections[index] = connection;
	connection._index = index;
	return connection;
}

TcpServer.prototype.onClose = function(connection) {
    var index = connection._index;
	if (index !== undefined &&
		index < this.connections.length &&
		this.connections[index] === connection) {
		this.connections[index] = null;
		this.disconnected.push(index);
		connection._index = undefined;
	}
	else {
		// error status.
	}
}

exports.TcpServer = TcpServer;