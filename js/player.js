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

	var player = function(obj, options){
		this.options = $.extend({
			width: 425,
			height: 356,
			swfobject: window.swfobject,
			playlist: [],
			repeat: 0,
			showPlaylist: 1,
			randomStart: 1,
			shuffle: 0,
			updateHash: 1,
			videoParams: { 
				allowScriptAccess: "always" 
			}
		}, options || {});
		this.$player = $(obj);
		this.$playerVideo = this.$player.find("#player-video");
		this.ytplayer = this.$player.find("#player-object").get(0);
		this.init();
	}

	player.prototype = {
		
		video:  0, state: -1, timer: {}, router: {}, states: {}, videoIds: [],

		init : function(){
			this.video = this.options.randomStart ? this.randomVideo() : 0;
			this.bindYtEvents().createPlayer().createToolbar().createInfobar().createPlaylist().bindPlayerEvents().initRouter();
		},

		initRouter :  function(){
			var self = this, hash = window.location.hash.replace(/.*?#\//, '');
			this.router = {
				hash: hash,
				actions: /\//.test(hash) ? hash.split('/') : ['v'],
				updateHash: function(){
					if (self.options.updateHash) 
					window.location.hash = '/'+self.router.actions[0]+'/'+self.options.playlist[self.video].id;
				}
			};
			switch(this.router.actions[0]){
				case 'v' : this.video = this.router.actions[1] ? $.inArray(this.router.actions[1], this.videoIds) : this.video; break;
				case 'p' : this.video = $.inArray(this.router.actions[1], this.videoIds); this.states.play = 1; break;
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
			this.$playerVideo.hover(
				function(){ (self.states.videoPlay) && self.updateInfo(); },
				function(){ (self.states.videoPlay) && (function(){ self.infobar.data('show', 0); self.hideInfo(); })(); }
			);
			return this;
		},

		ytplayerEventRouter : function(state){
			switch(this.state = state) {
				case 0 : this.events.yt.videoEnded(this); break;
				case 1 : this.events.yt.videoPlay(this); this.toolbar.updateStates(); break;
				case 3 : this.events.yt.videoBuffer(this); break;
				case 9 : this.events.yt.ready(this); break;
			}
		},

		events : {
			play : function(player, button, playlistItem){
				player.events.updatePlaylist(player);
				player.states.play = 1;
				player.$loader.show();
				player.loadVideo();
				player.toolbar.updateStates();
				player.ytplayer.playVideo();
				(player.state == -1) && player.$loader.show();
			},
			pause : function(player, button){
				player.states.pause = 1;
				player.ytplayer.pauseVideo();
			},
			prev : function(player, button){
				player.$loader.show();
				if (player.video > 0) {
					player.video--;
					player.events.play(player);
				}
			},
			next : function(player, button){
				player.states.play = 1;
				player.$loader.show();
				if (player.video < player.options.playlist.length-1) {
					if (player.options.shuffle) player.randomVideo();
					else player.video++;
					player.events.play(player);
				}
			},
			shuffle : function(player, button){ 
				player.options.shuffle = 1;
				player.states.shuffle = player.states.shuffle && button.toggle ? 0 : 1;
				player.randomVideo();
				player.events.play(player);
			},
			repeat : function(player, button){
				player.options.repeat = 1;
				player.states.repeat = player.states.repeat && button.toggle ? 0 : 1;
			},
			mute : function(player, button){
				player.states.mute = player.states.mute && button.toggle ? 0 : 1;
				if (player.states.mute) player.ytplayer.mute();
				else player.ytplayer.unMute();
			},
			playlist : function(player, button){
				player.states.playlist = player.states.playlist && button.toggle ? 0 : 1;
				player.playlistContainer.animate({height: "toggle", opacity: "toggle"}, 550);
			},
			updatePlaylist : function(player){
				player.playlist.find("li").removeClass("ui-state-active").each(function(key){
					if (player.options.playlist[player.video].id == $(this).data("video").id) {
						var height = $(this).addClass("ui-state-active").outerHeight();
						player.scrollbar.pos = (key * height) - (3 * height);
						player.playlistScroller.scrollTop(player.scrollbar.pos);
						return false;
					}
				});
			},
			yt : {
				ready : function(player){
					player.ytplayer = player.$player.find("object:first").get(0);
					player.ytplayer.addEventListener("onStateChange", "_ytplayerevents");
					player.toolbar.container.fadeIn(400);
					player.cueVideo();
					(player.options.showPlaylist) && player.playlist.fadeIn(400);
					(player.states.play) && player.events.play(player);
				},
				videoPlay : function(player){
					player.states.videoPlay = player.states.play = 1;
					player.events.updatePlaylist(player);
					player.updateInfo();
					player.router.updateHash();
				},
				videoEnded : function(player){
					(player.options.repeat) && player.events.next(player);
				},
				videoBuffer : function(player){}
			},
			scrollbar : {
				up : function(player, button){
					player.scrollbar.pos = 
						player.scrollbar.pos > player.playlist.find("li:first").height() ? 
						player.scrollbar.pos - 50 : 
						0;
					player.playlistScroller.scrollTop(player.scrollbar.pos);
				},
				down : function(player, button){
					player.scrollbar.pos = 
						player.scrollbar.pos < player.playlist.outerHeight() - player.playlistScroller.outerHeight() ? 
						player.scrollbar.pos + player.playlist.find("li:first").height() : 
						player.scrollbar.pos;
					player.playlistScroller.scrollTop(player.scrollbar.pos);
				}
			}
		},

		updateInfo : function(){
			var self = this;
			clearTimeout(this.timer.hideInfo);
			this.$loader.hide();
			(!this.infobar.data('show')) && 
				this.infobar.stop().data('show', 1).css({opacity: 0})
				.html(this.options.playlist[this.video].title)
				.animate({opacity: 1}, 400, function(){
					self.infobar.data('show', 0);
					self.timer.hideInfo = setTimeout(function(){
						self.hideInfo();
					}, 6000);
				});
		},

		hideInfo : function(){
			this.infobar.stop().animate({opacity: 0});
		},

		cueVideo : function(videoID){
			this.ytplayer.cueVideoById(videoID || this.options.playlist[this.video].id, 0);
		},

		loadVideo : function(videoID){
			var self = this;
			this.infobar.stop().css({opacity: 0});
			this.ytplayer.loadVideoById(videoID || this.options.playlist[this.video].id, 0);
			this.router.updateHash();
		},

		randomVideo : function(){
			this.video = Math.floor(Math.random() * this.options.playlist.length);
			return this.video;
		},

		createPlayer : function(){
			this.$player.width(this.options.width);
			this.$playerVideo.height(this.options.height);
			(this.options.swfobject) && this.options.swfobject.embedSWF(
				"http://www.youtube.com/apiplayer?enablejsapi=1&version=3&playerapiid=ytplayer&hd=1&showinfo=0", 
				this.ytplayer.id, this.options.width, this.options.height, "8", null, null, this.options.videoParams
			);
			return this;
		},

		createToolbar : function(){
			var self = this;

			this.toolbar = {
				container: $('<ul id="player-toolbar" class="ui-widget ui-helper-clearfix ui-widget-header ui-corner-all"></ul>'),
				updateStates : function(){
					self.toolbar.container.find(".ui-state-active").removeClass("ui-state-active");
					for(var state in self.states) {
						(self.states[state]) &&
						(self.toolbar.buttons[state]) && 
						(self.toolbar.buttons[state].toggle || (self.toolbar.buttons[state].toggleButton && !self.states[self.toolbar.buttons[state].toggleButton])) &&
						self.toolbar.buttons[state].obj.addClass("ui-state-active");
					}
				},
				buttons : {
					play: { text: 'Play', cssclass: 'ui-icon-play', toggleButton: 'pause' },
					pause: { text: 'Pause', cssclass: 'ui-icon-pause', toggleButton: 'play' },
					prev: { text: 'Prev', cssclass: 'ui-icon-seek-prev' },
					next: { text: 'Next', cssclass: 'ui-icon-seek-next' },
					shuffle: { text: 'Shuffle/Random', cssclass: 'ui-icon-shuffle', toggle: 1 },
					repeat: { text: 'Repeat playlist', cssclass: 'ui-icon-refresh', toggle: 1 },
					volume: { text: 'Mute', cssclass: 'ui-icon-volume-on', toggle: 1 },
					playlist: { text: 'Toggle playlist', cssclass: 'ui-icon-script', toggle: 1 }
				}
			}

			for(var button in this.toolbar.buttons) {
				if (this.toolbar.buttons[button].disabled) continue;

				this.toolbar.buttons[button].obj = $('<li class="ui-state-default ui-corner-all"></li>')
				.append('<span class="ui-icon '+this.toolbar.buttons[button].cssclass+'"></span></li>')
				.attr('title', this.toolbar.buttons[button].text)
				.data('button', button)
				.hover(
					function(){ $(this).addClass("ui-state-hover"); },
					function(){ $(this).removeClass("ui-state-hover"); }
				)
				.click(function(){
					var button = $(this).data("button");
					if (self.toolbar.buttons[button].toggleButton) self.states[self.toolbar.buttons[button].toggleButton] = 0;
					self.events[$(this).addClass("ui-state-active").data("button")](self, self.toolbar.buttons[button]);
					self.toolbar.updateStates();
				})
				.appendTo(this.toolbar.container);
			}

			this.$playerVideo.after(this.toolbar.container);
			this.$loader = $('<span id="player-loader"></span>');
			this.toolbar.container.after(this.$loader);

			return this;
		},

		createInfobar : function(){
			this.infobar = $('<div id="player-infobar"></div>');
			this.$playerVideo.prepend(this.infobar);
			return this;
		},

		createPlaylist : function(){
			var self = this;

			this.playlistScroller = $('<div id="player-playlist-scroller"></div>');
			($.fn.mousewheel) &&
				this.playlistScroller.bind('mousewheel', function(event, delta) {
					delta > 0 ? self.events.scrollbar.up(self) : self.events.scrollbar.down(self);
				});

			this.playlistContainer = $('<div id="player-playlist-container"></div>');
			this.playlist = $('<ol id="player-playlist"></ol>');
			this.scrollbar = {
				bar : 
					$('<div id="player-playlist-scrollbar"></div>')
					.appendTo(this.playlistContainer),
				up : 
					$('<span id="player-playlist-scrollbar-up" class="ui-icon ui-icon-circle-triangle-n"></span>')
					.click(function(){ self.events.scrollbar.up(self); })
					.appendTo(this.playlistContainer),
				down : 
					$('<span id="player-playlist-scrollbar-down" class="ui-icon ui-icon-circle-triangle-s"></span>')
					.click(function(){ self.events.scrollbar.down(self); })
					.appendTo(this.playlistContainer),
				pos : 0
			}

			for(var video in this.options.playlist) {
				this.videoIds.push(this.options.playlist[video].id);
				$('<li></li>')
				.data("video", this.options.playlist[video])
				.append(this.options.playlist[video].title)
				.click(function(){
					self.video = $.inArray($(this).data("video").id, self.videoIds);
					self.events.play(self, null, this);
				})
				.appendTo(this.playlist);
			}

			this.$playerVideo.after(
				this.playlistContainer.append(
					this.playlistScroller.append(this.playlist)
				)
			);

			return this;
		}
	};

})(jQuery);
