
// 相关的响应。
function Response(pool, connection, id) {
	var mConnection = connection;
	var mRequestId = id;
	var mFree = false;
	
	this.Reset = function(newConnection, newId) {
		if (!mFree) {
			console.ERROR("I am not free now, DO CHECK IT");
			// return;
		}

		mConnection = newConnection;
		mRequestId = newId;
		mFree = false;
	}

	this.Error = function(error) {
		//console.LOG("Response.Error:" + error);

		var buff = global.CommandManager.Build(error, undefined, undefined, mRequestId);
		mConnection.sendBytes(buff);
		this.Done();
	}
	
	this.Send = function(data, schema) {
		var buff = global.CommandManager.Build(undefined, data, schema, mRequestId);
		mConnection.sendBytes(buff);
		this.Done();
	}

	this.Done = function() {
		if (mFree) {
			console.ERROR("I am free now, DO CHECK IT!!!");
			// return
		}

		pool.Done(this);
		mFree = true;
	}
}

// 简单的响应池
// 避免过多的内存申请来制作的。
function ResponsePool() {
	var mResponses = [];
	
	// 申请一个新的。
	this.Get = function(connection, id) {
		if (mResponses.length === 0)
			return new Response(this, connection, id);
		
		var response = mResponses.pop();
		response.Reset(connection, id);
		return response;
	}
	
	this.Done = function(response) {
		mResponses.push(response);
	}
}

exports.ResponsePool = ResponsePool;
