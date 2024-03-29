"use strict";
var fs = require('fs');
var fsp = require('path');
var YAML = require('js-yaml');

var skipped = /^(\..*|bruno|public)$/;

var node = /^(child_process|cluster|crypto|events|fs|http|https|module|net|os|path|querystring|readline|sys|url|util|vm|zlib)$/;

function doDir(_, path, fn) {
	fs.readdir(path, _).forEach_(_, function(_, name) {
		if (skipped.test(name)) return;
		var p = fsp.join(path, name);
		var stat = fs.stat(p, _);
		if (stat.isDirectory()) doDir(_, p, fn);
		else if (/\.(js|_js|json|coffee|_coffee)$/.test(name)) {
			var text = fs.readFile(p, 'utf8', _);
			fn(_, path, text);
		}
	});
}

var root = process.argv[2] || '.';
var dirs = fs.readdir(root, _).filter_(_, function(_, s) {
	return !skipped.test(s) && fs.stat(fsp.join(root, s), _).isDirectory();
});

var RE = new RegExp('require\\(["\']([^.][^"\'/]+)[^"\']*["\']\\)', 'g');

var dependencies = {};
dirs.forEach_(_, function(_, d) {
	if (skipped.test(d)) return;
	dependencies[d] = {};
	doDir(_, fsp.join(root, d), function(_, path, text) {
		text.replace(RE, function(all, s) {
			if (d !== s && !node.test(s)) dependencies[d][s] = (dependencies[d][s] || 0) + 1;
		});
	});
});

//console.log(dependencies);
var rev = {};
Object.keys(dependencies).forEach(function(k1) {
	Object.keys(dependencies[k1]).forEach(function(k2) {
		rev[k2] = rev[k2] || {};
		rev[k2][k1] = (rev[k2][k1] || 0) + dependencies[k1][k2];
	});
});

function reorder(obj) {
	if (!obj || typeof obj !== 'object') return obj;
	return Object.keys(obj).sort().reduce(function(r, k) {
		r[k] = reorder(obj[k]);
		return r;
	}, {})
}

dependencies = reorder(dependencies);
rev = reorder(rev);

function cyclesOnly(o1, o2) {
	var cont = false;
	do {
		var modified = false;
		Object.keys(o1).slice(0).forEach(function(k1) {
			var empty = true;
			Object.keys(o1[k1]).slice(0).forEach(function(k2) {
				if (!o1[k2]) {
					delete o1[k1][k2];
					delete o2[k2];
					cont = true;
				} else {
					empty = false;
				}
			});
			if (empty) {
				delete o1[k1];
				modified = true;
			}
		});
	} while (modified);
	return cont;
}

while (cyclesOnly(dependencies, rev) && cyclesOnly(rev, dependencies));

console.log(YAML.safeDump({
	uses: dependencies,
	//'used-by': rev
}));