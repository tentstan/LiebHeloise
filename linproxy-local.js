"use strict"

const socks = require('socksv5');
const proxysession = require('./proxysession');
const tunnels = require('./tunnels')

tunnels.setupWS();

let srv = socks.createServer(function(info, accept, deny) {
	let srcAddr = info.srcAddr;
	let srcPort = info.srcPort;
	let dstAddr = info.dstAddr;
	let dstPort = info.dstPort;
	console.log('accept sock, srcAddr:', srcAddr, ',srcPort:', srcPort, ',dstAddr:', dstAddr, ',dstPort:', dstPort);
	let sock = accept(true);
	proxysession.create(info, sock);
});

const socks5_port = 1080;
const http_proxy_port = 1081;

srv.listen(socks5_port, 'localhost', function() {
	console.log('SOCKS server listening on port:', socks5_port);
});

srv.useAuth(socks.auth.None());

const httpproxy = require('./httpproxy');
httpproxy.create(http_proxy_port);
