
var fs = require("fs");
var ResponsePool = require("./base/response_pool").ResponsePool;

// 处理客户端回复的消息
if (global.CommandManager === undefined) global.CommandManager = new function() {
	var mProtoParser = undefined;
	var mProtoFile = "./protos/command.desc";
	var mResponsePool = new ResponsePool();
	var mIndexKeyMap = [];
	var mBuffCache = new Buffer(1024 * 1024); // 1mb buffer
	var mSendBuffCache = new Buffer(1024 * 1024); // 1mb buffer
	var mMessageHandles = {};
	var mResponseHandle = undefined;

	// init the command proto buffer description.
	this.Init = function() {
		var Protobuf = undefined;
		if (require('os').platform() === 'linux')
			Protobuf = require("node-protobuf").Protobuf;
		else
			Protobuf = require("protobuf").Protobuf;
		mProtoParser = new Protobuf(fs.readFileSync(mProtoFile));
		mResponseHandle = mProtoParser.MessageHandle("Response");
		var requestMessageHandle = mProtoParser.MessageHandle("RequestMessage");
		
		// try to parse ...
		for (var key in global.Service.Handlers) {
			var func = global.Service.Handlers[key];
			var input = {Type: "E" + key};
			var size = mProtoParser.Serialize(input, requestMessageHandle, mBuffCache);
			var output = mBuffCache.slice(0, size);
			var msg = mProtoParser.Parse(output, requestMessageHandle);
			if (msg.Type === undefined) {
				console.ERROR("Command not found in proto: " + key);
				continue;
			}
			mIndexKeyMap[msg.Type] = key;
		}
		
		for (var index in mIndexKeyMap) {
			var key = mIndexKeyMap[index];
			global.Service.Handlers[index] = global.Service.Handlers[key];
		}
	}

	// parse the buffer.
	this.Process = function(connection, buf, handlers) {
		var messageName = "[unparsed]";
		try {
			var msgType = buf.readUInt8(0);
			if (mIndexKeyMap.length <= msgType)
				return console.ERROR("msgType not found in array: ", msgType);
				
			messageName = mIndexKeyMap[msgType];
			//console.LOG("Receving: " + messageName);

			// 查找一下对应的处理函数绑定。
			var handler = handlers[msgType];
			if (handler === undefined)
				return console.ERROR("Message %s has no handler binding.", messageName);
			
			// 记录消息收到的个数。
			global.Status[messageName] = (global.Status[messageName] || 0) + 1;

			// 消息名字后面是请求的id号，uint16 [1024-65535]
			var requestId = buf.readUInt16LE(1);

			// 从protobuf里面解析出消息体。
			var dataBuf = buf.slice(3);
			
			var handle = mMessageHandles[messageName];
			if (!handle)
				handle = mMessageHandles[messageName] = mProtoParser.MessageHandle(messageName);

			var message = mProtoParser.Parse(dataBuf, handle);
			
			// 申请一个对应的响应体出来。
			var response = mResponsePool.Get(connection, requestId);

			// 调用相关的处理函数。
			//connection.sendBytes(buf);
			handler(global.Service, message, connection, response);
		}
		catch (err) {
			var msg = "Buff:" + buf.toString('hex') + "\n";
			msg += "Message:" + messageName + "\n";
			msg += "CommandManager.Process Exception:" + err + "\n";
			console.ERROR(msg);
		}
	}
	
	this.Build = function(error, data, schema, id) {
		var response = { id: id };
		if (error) {
			response.error = error;
		}
		else if (schema) {
			response.data = JSON.stringify(data);
		}
		else if (data) {
			response.data = data;
		}

		var msgSize = mProtoParser.Serialize(response, mResponseHandle, mSendBuffCache);
		return mSendBuffCache.slice(0, msgSize);
	}
}
