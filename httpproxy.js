"use strict"

const http = require('http');
const net = require('net');
const url = require('url');
const listen_port = 1081;

const conproxysession = require('./conproxysession');
const reqproxysession = require('./reqproxysession');
const tunnels = require('./tunnels')

tunnels.setupWS();

function requestListener(req, res) {
	console.log(`requestListener: ${req.url}`);
	
	// res.writeHead(200, { 'Content-Type': 'text/plain' });
	// res.end('okay');	
	const srvUrl = url.parse(`${req.url}`);

	let info = {};
	info.cmd = 'connect';
	info.srcAddr = req.socket.localAddress;
	info.srcPort = req.socket.localPort;
	info.dstAddr = srvUrl.hostname;
	if (srvUrl.port) {
		info.dstPort = srvUrl.port;
	} else {
		info.dstPort = 80;
	}

	reqproxysession.create(info, req, res, srvUrl.path);	
}

function connectListener(req, cltSocket, head) {
	// connect to an origin server
	console.log(`connectListener: ${req.url}`);
	const srvUrl = url.parse(`http://${req.url}`);
	
	let info = {};
	info.cmd = 'connect';
	info.srcAddr = req.socket.localAddress;
	info.srcPort = req.socket.localPort;
	info.dstAddr = srvUrl.hostname;
	info.dstPort = srvUrl.port;

	conproxysession.create(info, cltSocket, head);
}

function httpproxy() {
}

httpproxy.create = function(listen_port) {
	// Create an HTTP tunneling proxy
	const proxy = http.createServer();

	// add listener
	proxy.on('request', requestListener);
	proxy.on('connect', connectListener);

	// now that proxy is running
	proxy.listen(listen_port, 'localhost');	
	
	console.log('HTTP Proxy server listening on port:', listen_port);
}

module.exports = httpproxy;
