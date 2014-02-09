
var mTableMgr = require('./table_mgr');
var mService = require('./service');
var mHandlers = require('./path_handler').Load();
var mConfig = require('./config.json');

// 在linux模式下以后台运行。
if (mConfig.Background) {
	var fs = require('fs');
	require('daemon')();
}
mTableMgr.Load();
mService.Start(mHandlers, mConfig);
