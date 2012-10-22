module.exports = function( grunt ) {

	grunt.registerMultiTask("upload", "Upload files to github", function () {
		var fs = require("fs");
		var utils = grunt.utils;
		var config = grunt.config;
		var log = grunt.log;
		var _ = utils._;

		var target = config.escape(this.target);
		var repo = [ "upload", target, "repo" ].join(".");
		var auth = [ "upload", target, "auth" ].join(".");
		var file = [ "upload", target, "file" ].join(".");
		var name = [ "upload", target, "name" ].join(".");
		var description = [ "upload", target, "description" ].join(".");

		this.requiresConfig(repo, auth, file);

		repo = config.process(repo);
		auth = config.process(auth);
		file = config.process(file);
		name = config.process(name) || this.target;
		description = config.process(description);

		var url = [ "https://api.github.com/repos", repo, "downloads" ].join("/");
		var done = this.async();

		utils.async.waterfall([
			function (callback) {
				log.write("Listing downloads...");

				utils.spawn({
					cmd : "curl",
					args : [ "-u", auth, url ]
				}, function (err, result) {
					if (err) {
						callback(err);
						return;
					}

					log.ok();

					callback(null, _.filter(JSON.parse(result), function (download) {
						return download.name === name;
					}));
				});
			},

			function (downloads, callback) {
				if (downloads.length === 0) {
					callback(null);
				}

				log.write("Deleting duplicate file...");

				utils.async.forEach(downloads, function (download, _callback) {
					utils.spawn({
						cmd : "curl",
						args : [ "-u", auth,
							"-X", "DELETE",
							[ url, download.id ].join("/") ]
					}, function (err, result) {
						if (err) {
							_callback(err);
							return;
						}

						_callback(null);
					});
				}, function (err) {
					if (err) {
						callback(err);
						return;
					}

					log.ok();

					callback(null);
				});
			},

			function (callback) {
				log.write("Creating download entry...");

				fs.stat(file, function (err, stats) {
					if (err) {
						callback(err);
						return;
					}

					utils.spawn({
						cmd : "curl",
						args : [ "-u", auth,
							"-X", "POST",
							"-d", JSON.stringify({
								name : name,
								description : description,
								size : stats.size
							}), url ]
					}, function (_err, result) {
						if (_err) {
							callback(_err);
							return;
						}

						log.ok();

						callback(null, JSON.parse(result));
					});
				});
			},

			function (response, callback) {
				log.write("Uploading file...");

				utils.spawn({
					cmd : "curl",
					args : [ "-X", "POST",
						"-F", "key=" + response.path,
						"-F", "acl=" + response.acl,
						"-F", "success_action_status=201",
						"-F", "Filename=" + response.name,
						"-F", "AWSAccessKeyId=" + response.accesskeyid,
						"-F", "Policy=" + response.policy,
						"-F", "Signature=" + response.signature,
						"-F", "Content-Type=" + response.mime_type,
						"-F", "file=@" + file,
						response.s3_url
					]
				}, function (err, result) {
					if (err) {
						callback(err);
						return;
					}

					log.ok();

					callback(null, result);
				});

			}
		], function (err) {
			if (err) {
				log.error(err);

				done(false);

				return;
			}

			done(true);
		});
	});
};