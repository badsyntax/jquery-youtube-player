/*
 * jquery.ytplayer.js - a jquery youtube player
 * Copyright (c) 2010 Richard Willis
 * MIT license  : http://www.opensource.org/licenses/mit-license.php
 * Project      : http://jquery-youtube-player.googlecode.com
 * Contact      : willis.rh@gmail.com | badsyntax.co.uk
 */

(function($){

	$.fn.player = function(options){
		return this.each(function(){
			$(this).data('player', new player(this, options));
		});
	}

	function player(obj, options){
		this.options = $.extend({
			width: 425,
			height: 356,
			swfobject: window.swfobject,
			playlists: [],
			defaultPlaylist: 0,
			playlistProxy: 'playlist_proxy.php',
			showPlaylist: 1,
			repeat: 0,
			randomStart: 1,
			autoStart: 0,
			shuffle: 0,
			updateHash: 0,
			videoParams: { 
				allowScriptAccess: 'always'
			},
			toolbar: {
				buttons : {
					play: { text: 'Play', cssclass: 'ui-icon-play', toggleButton: 'pause' },
					pause: { text: 'Pause', cssclass: 'ui-icon-pause', toggleButton: 'play' },
					prev: { text: 'Prev', cssclass: 'ui-icon-seek-prev' },
					next: { text: 'Next', cssclass: 'ui-icon-seek-next' },
					shuffle: { text: 'Shuffle/Random', cssclass: 'ui-icon-shuffle', toggle: 1 },
					repeat: { text: 'Repeat playlist', cssclass: 'ui-icon-refresh', toggle: 1 },
					volume: { text: 'Mute', cssclass: 'ui-icon-volume-on', toggle: 1 },
					playlist: { text: 'Toggle playlist', cssclass: 'ui-icon-script', toggle: 1 },
					playlists: { text: 'Toggle playlists', cssclass: 'ui-icon-video', toggle: 1 }
				}
			}
		}, options || {});
		this.init(obj);
	}

	player.prototype = {
		
		state: -1, timer: {}, router: {}, videoIds: [], elements: {},

		init : function(obj){
			this.elements.$player = $(obj);
			this.elements.$playerVideo = $('#player-video');
			this.elements.$playerObject = $('#player-object');
			this.keys = {
				video: 0, 
				playlist: this.options.defaultPlaylist
			};
			this.ytplayer = this.elements.$playerObject.get(0);
			this.getPlaylistData(
				function(){ // success
					this.keys.video = this.options.randomStart ? this.randomVideo() : 0;
					this
					.createElements()
					.bindPlayerEvents()
					.bindYtEvents()
					.initRouter();
				}, 
				function(){ // error
					this.elements.$playerObject.html('There was an error loading the playlist.').removeClass('playlist-loading');
				}
			);
		},

		getPlaylistData : function(callback, error){
			var self = this, playlist = this.options.playlists[this.keys.playlist];
			if (String === playlist.constructor) {
				self.elements.$playerObject.html('loading playlist..').addClass('playlist-loading');
				var xhr = $.ajax({
					type: 'GET',
					url: self.options.playlistProxy + '?url=' + playlist,
					dataType: 'json',
					error: function(){ error.call(self); },
					success: function(json){
						if (!json) { error.call(self); return; }
						// replace playlist url with json array
						self.options.playlists[self.keys.playlist] = [];
						$.each(json.feed.entry, function(key, vid){
							self.options.playlists[self.keys.playlist].push({
								id: vid.link[0].href.replace(/^[^v]+v.(.{11}).*/, '$1'), // munge video id from href
								title: vid.title.$t
							});
						});
						self.elements.$playerObject.fadeOut(180, function(){
							callback.call(self);
						});
					}
				});
			} else callback.call(self);
		},

		initRouter :  function(){
			var self = this, hash = window.location.hash.replace(/.*?#\//, '');
			this.router = {
				hash: hash,
				actions: /\//.test(hash) ? hash.split('/') : ['v'],
				updateHash: function(){
					if (self.options.updateHash) 
					window.location.hash = '/'+self.router.actions[0]+'/'+self.options.playlists[self.keys.playlist][self.keys.video].id;
				}
			};
			switch(this.router.actions[0]){
				case 'v' : this.keys.video = this.router.actions[1] ? $.inArray(this.router.actions[1], this.videoIds) : this.keys.video; break;
				case 'p' : this.keys.video = $.inArray(this.router.actions[1], this.videoIds); break;
				default : break;
			} 
		},
		
		bindYtEvents : function(){
			var self = this;
			window.onYouTubePlayerReady = function(){ self.ytplayerEventRouter(9); };
			window._ytplayerevents = function(state){ self.ytplayerEventRouter(state); };
			return this;
		},

		bindPlayerEvents : function(){
			var self = this;
			this.elements.$playerVideo
			.bind('mouseenter', function(){ self.updateInfo(); })
			.bind('mouseleave', function(){ self.hideInfo(); });
			return this;
		},

		ytplayerEventRouter : function(state){
			console.log(state);
			if (state != this.state) {
				switch(this.state = state) {
					case 0 : this.events.yt.videoEnded(this); break;
					case 1 : this.events.yt.videoPlay(this); break;
					case 3 : this.events.yt.videoBuffer(this); break;
					case 9 : this.events.yt.ready(this); break;
				}
			}
		},

		events : {
			play : function(player, button, playlistItem){
				player.elements.$loader.show();
				player.loadVideo();
				player.ytplayer.playVideo();
			},
			pause : function(player, button){
				player.ytplayer.pauseVideo();
			},
			prev : function(player, button){
				if (player.keys.video > 0) {
					player.keys.video--;
					player.elements.toolbar.buttons.play.obj.data('state', 0);
					player.events.play(player);
				}
			},
			next : function(player, button){
				if (player.keys.video < player.options.playlists[player.keys.playlist].length-1) {
					if (player.options.shuffle) player.randomVideo();
					else player.keys.video++;
					player.elements.toolbar.buttons.play.obj.data('state', 0);
					player.events.play(player);
				}
			},
			shuffle : function(player, button){ 
				player.randomVideo();
				player.events.play(player);
			},
			repeat : function(player, button){
				player.options.repeat = 1;
			},
			mute : function(player, button){
				if (button.obj.data('state')) player.ytplayer.mute();
				else player.ytplayer.unMute();
			},
			playlist : function(player, button){
				player.elements.$playlistContainer.animate({height: 'toggle', opacity: 'toggle'}, 550);
			},
			updatePlaylist : function(player){
				player.elements
				.$playlist.find('li').removeClass('ui-state-active')
				.each(function(key){
					if (player.options.playlists[player.keys.playlist][player.keys.video].id == $(this).data('video').id) {
						var height = $(this).addClass('ui-state-active').outerHeight();
						player.elements.scrollbar.pos = (key * height) - (3 * height);
						player.elements.$playlistScroller.scrollTop(player.elements.scrollbar.pos);
						return false;
					}
				});
			},
			yt : {
				ready : function(player){
					player.ytplayer = player.elements.$player.find('object:first').get(0);
					player.ytplayer.addEventListener('onStateChange', '_ytplayerevents');
					player.ytplayer.addEventListener('onError', '_ytplayerevents');
					player.cueVideo();
					player.elements.toolbar.$container.fadeIn(800);
					(player.options.showPlaylist) && player.playlist.fadeIn(400);
				},
				videoPlay : function(player){
					player.elements.$loader.hide();
					if (!player.elements.toolbar.buttons.play.obj.data('state')) {
						player.events.updatePlaylist(player);
						player.router.updateHash();
						player.elements.toolbar.buttons.play.obj.data('state', 1);
						player.elements.toolbar.updateStates();
						player.elements.$infobar.css({opacity: 0})
						player.updateInfo(320);
					}
				},
				videoEnded : function(player){
					(player.options.repeat) && player.events.next(player);
				},
				videoBuffer : function(player){}
			},
			scrollbar : {
				up : function(player, button){
					player.elements.scrollbar.pos = 
						player.elements.scrollbar.pos > player.elements.$playlist.find('li:first').height() ? 
						player.elements.scrollbar.pos - player.elements.$playlist.find('li:first').height() : 
						0;
					player.elements.$playlistScroller.scrollTop(player.elements.scrollbar.pos);
				},
				down : function(player, button){
					player.elements.scrollbar.pos = 
						player.elements.scrollbar.pos < player.elements.$playlist.outerHeight() - player.elements.$playlistScroller.outerHeight() ? 
						player.elements.scrollbar.pos + player.elements.$playlist.find('li:first').height() : 
						player.elements.scrollbar.pos;
					player.elements.$playlistScroller.scrollTop(player.elements.scrollbar.pos);
				}
			}
		},

		updateInfo : function(timeout, text){
			var self = this;
			this.elements.$loader.hide();
			if (this.elements.$infobar.css('opacity') < 1) {
				clearTimeout(this.timer.hideInfo);
				this.timer.showInfo = setTimeout(function(){
					self.elements.$infobar
					.stop().css({opacity: 0}).unbind('click')
					.html(text || self.options.playlists[self.keys.playlist][self.keys.video].title)
					.click(function(){ window.open(self.ytplayer.getVideoUrl()); })
					.animate({opacity: 1}, 340, function(){
						self.timer.hideInfo = setTimeout(function(){
							self.hideInfo();
						}, 6000);
					});
				}, timeout || 0);
			}
		},

		hideInfo : function(){
			clearTimeout(this.timer.hideInfo);
			clearTimeout(this.timer.showInfo);
			this.elements.$infobar.stop().animate({opacity: 0});
		},

		cueVideo : function(videoID){
			this.ytplayer.cueVideoById(videoID || this.options.playlists[this.keys.playlist][this.keys.video].id, 0);
		},

		loadVideo : function(videoID){
			var self = this;
			this.elements.$infobar.stop().css({opacity: 0});
			this.ytplayer.loadVideoById(videoID || this.options.playlists[this.keys.playlist][this.keys.video].id, 0);
			this.router.updateHash();
		},

		randomVideo : function(){
			this.keys.video = Math.floor(Math.random() * this.options.playlists[this.keys.playlist].length);
			return this.keys.video;
		},

		createElements : function(){
			return this
			.createPlayer()
			.createToolbar()
			.createInfobar()
			.createPlaylist();
		},

		createPlayer : function(){
			this.elements.$player.width(this.options.width);
			this.elements.$playerVideo.height(this.options.height);
			(this.options.swfobject) && this.options.swfobject.embedSWF(
				'http://www.youtube.com/apiplayer?enablejsapi=1&version=3&playerapiid=ytplayer&hd=1&showinfo=0', 
				this.ytplayer.id, this.options.width, this.options.height, '8', null, null, this.options.videoParams
			);
			return this;
		},

		createToolbar : function(){
			var self = this;

			this.elements.toolbar = $.extend({
				$container: $('<ul id="player-toolbar" class="ui-widget ui-helper-clearfix ui-widget-header ui-corner-all">'),
				updateStates : function(){
					$.each(self.elements.toolbar.buttons, function(key){
						this.obj.removeClass('ui-state-active');
						(this.obj.data('state')) &&
						(this.toggle || 
							(this.toggleButton && 
							self.elements.toolbar.buttons[this.toggleButton])) &&
							this.obj.addClass('ui-state-active');
					});
				}
			}, this.options.toolbar || {});

			$.each(this.elements.toolbar.buttons, function(key) {
				if (this.disabled) return true;
				var buttonObj = this;
				this.obj = 
				$('<li class="ui-state-default ui-corner-all">')
				.append('<span class="ui-icon '+this.cssclass+'">')
				.attr('title', this.text)
				.data('button', key)
				.bind('mouseenter', function(){ $(this).toggleClass('ui-state-hover'); })
				.bind('mouseleave', function(){ $(this).toggleClass('ui-state-hover'); })
				.click(function(){
					var button = 
					$(this)
					.data('state', $(this).data('state') && buttonObj.toggle ? 0 : 1)
					.data('button');

					(buttonObj.toggleButton) &&
					self.elements.toolbar.buttons[buttonObj.toggleButton].obj.data('state', 0);

					self.elements.toolbar.updateStates();
					self.events[button](self, buttonObj);
				})
				.appendTo(self.elements.toolbar.$container);
			});

			this.elements.$playerVideo.after(this.elements.toolbar.$container);
			this.elements.$loader = $('<span>').addClass('player-loader');
			this.elements.toolbar.$container.after(this.elements.$loader);
			return this;
		},

		createInfobar : function(){
			this.elements.$infobar = $('<div id="player-infobar">');
			this.elements.$playerVideo.prepend(this.elements.$infobar);
			return this;
		},

		createPlaylist : function(){
			var self = this;

			this.elements.$playlistScroller = $('<div id="player-playlist-scroller">');
			($.fn.mousewheel) &&
				this.elements.$playlistScroller.bind('mousewheel', function(event, delta) {
					delta > 0 ? self.events.scrollbar.up(self) : self.events.scrollbar.down(self);
				});

			this.elements.$playlistContainer = $('<div id="player-playlist-container">');
			this.elements.$playlist = $('<ol id="player-playlist">');
			this.elements.scrollbar = {
				bar : 
					$('<div id="player-playlist-scrollbar">')
					.appendTo(this.elements.$playlistContainer),
				up : 
					$('<span id="player-playlist-scrollbar-up" class="ui-icon ui-icon-circle-triangle-n">')
					.click(function(){ self.events.scrollbar.up(self); })
					.appendTo(this.elements.$playlistContainer),
				down : 
					$('<span id="player-playlist-scrollbar-down" class="ui-icon ui-icon-circle-triangle-s">')
					.click(function(){ self.events.scrollbar.down(self); })
					.appendTo(this.elements.$playlistContainer),
				pos : 0
			}

			$.each(this.options.playlists[this.keys.playlist], function(){
				self.videoIds.push(this.id);
				$('<li></li>').data('video', this).append(this.title)
				.click(function(){
					self.keys.video = $.inArray($(this).data('video').id, self.videoIds);
					self.elements.toolbar.buttons.play.obj.data('state', 0);
					self.events.play(self, null, this);
				})
				.appendTo(self.elements.$playlist);
			});

			this.elements.$playerVideo.after(
				this.elements.$playlistContainer.append(
					this.elements.$playlistScroller.append(this.elements.$playlist)
				)
			);

			return this;
		}
	};

})(jQuery);
