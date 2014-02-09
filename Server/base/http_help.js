
var http = require('http');
var https = require('https');
var url = require('url');
var util = require('util');
var querystring = require('querystring');

exports.HttpGet = function(options, callback) {
	if ('string' === typeof options)
		options = url.parse(options);
	http.get(options, function(response) {
		var res_data = '';
		response.on('data', function(chunk){
			res_data += chunk;
		});
		response.on('end', function(){
			if (callback) callback(undefined, res_data);
		});
	}).on('error', function(e) {
		callback(e.message);
	});
}

exports.HttpPost = function(url_str, data, callback) {
	var content = JSON.stringify(data);
	var parse_u = url.parse(url_str, true);
	var isHttp = (parse_u.protocol == 'http:');
	var options = {
		host: parse_u.hostname,
		port: parse_u.port || (isHttp ? 80 : 443),
		path: parse_u.path,
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': content.length
		}
	};
	
	var req = (isHttp ? http: https).request(options, function(response){
		var res_data = '';
		response.on('data', function(chunk){
			res_data += chunk;
		});
		response.on('end', function(){
			callback(undefined, res_data);
		});
	});
	req.on('error', function(e) {
		callback(e.message);
	});
	req.write(content);
	req.end();
};