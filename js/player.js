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
			repeat: 1,
			showPlaylist: 0,
			randomStart: 1,
			shuffle: 0,
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
		
		track:  0, timer: {}, router: {}, states: {}, trackIds: [],

		init : function(){
			this.track = this.options.randomStart ? Math.floor(Math.random() * this.options.playlist.length) : 0;
			this.createPlayer().createToolbar().createInfobar().createPlaylist().bindEvents().initRouter();
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
				states : function(){
					self.toolbar.container.find(".ui-state-active").removeClass("ui-state-active");
					for(var state in self.states) {
						(self.states[state]) &&
						(self.toolbar.buttons[state]) && 
						(self.toolbar.buttons[state].toggle || (self.toolbar.buttons[state].toggleButton && !self.states[self.toolbar.buttons[state].toggleButton])) &&
						self.toolbar.buttons[state].obj.addClass("ui-state-active");
					}
				},
				buttons : {
					play: { text: 'Play', classname: 'ui-icon-play', toggleButton: 'pause' },
					pause: { text: 'Pause', classname: 'ui-icon-pause', toggleButton: 'play' },
					prev: { text: 'Prev', classname: 'ui-icon-seek-prev' },
					next: { text: 'Next', classname: 'ui-icon-seek-next' },
					shuffle: { text: 'Shuffle/Random', classname: 'ui-icon-shuffle', toggle: 1 },
					repeat: { text: 'Repeat playlist', classname: 'ui-icon-refresh', toggle: 1 },
					volume: { text: 'Volume', classname: 'ui-icon-volume-on', disabled: 1 },
					playlist: { text: 'Toggle playlist', classname: 'ui-icon-script' }
				}
			}
			for(var button in this.toolbar.buttons) {
				if (this.toolbar.buttons[button].disabled) continue;
				this.toolbar.buttons[button].obj = $('<li class="ui-state-default ui-corner-all"></li>')
				.append('<span class="ui-icon '+this.toolbar.buttons[button].classname+'"></span></li>')
				.attr('title', this.toolbar.buttons[button].text)
				.data('button', button)
				.hover(
					function(){ $(this).addClass("ui-state-hover"); },
					function(){ $(this).removeClass("ui-state-hover"); }
				)
				.click(function(){
					var button = $(this).data("button");
					if (self.toolbar.buttons[button].toggleButton) self.states[self.toolbar.buttons[button].toggleButton] = 0;
					self.actions[$(this).addClass("ui-state-active").data("button")](self, self.toolbar.buttons[button]);
					self.toolbar.states();
				}).appendTo(this.toolbar.container);
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
			this.trackIds = [];
			this.playlist = $('<ul id="player-playlist"></ul>');
			for(var track in this.options.playlist) {
				this.trackIds.push(this.options.playlist[track].id);
				$('<li></li>')
				.data("track", this.options.playlist[track])
				.append('<span class="ui-icon ui-icon-triangle-1-e">')
				.append(this.options.playlist[track].title)
				.click(function(){
					self.$loader.show();
					self.track = $.inArray($(this).data("track").id, self.trackIds);
					self.loadVideo($(this).data("track").id);
					self.states.play = 1;
					self.toolbar.states();
				})
				.appendTo(this.playlist);
			}
			this.$playerVideo.after(this.playlist);
			return this;
		},

		onReady : function(){
			var self = this;
			window._ytplayerevents = function(state){ self.ytplayerEvents(state); };
			this.ytplayer = this.$player.find("object:first").get(0);
			this.ytplayer.addEventListener("onStateChange", "_ytplayerevents");
			this.toolbar.container.fadeIn(400);
			(this.options.showPlaylist) && (this.playlist.fadeIn(400));
			this.cueVideo();
		},

		initRouter :  function(){
			var self = this, hash = window.location.hash.replace(/.*?#\//, '');
			this.router = {
				hash: hash,
				actions: hash.split('/'),
				updateHash: function(){
					window.location.hash = '/v/'+self.options.playlist[self.track].id;
				}
			};
			if (this.router.actions.length && this.router.actions[0] === 'v') 
				this.track = $.inArray(this.router.actions[1], this.trackIds);
		},

		bindEvents : function(){
			var self = this;
			this.$playerVideo.hover(
				function(){ (self.states.videoPlay) && self.updateInfo(); },
				function(){ (self.states.videoPlay) && (function(){self.infobar.data('show', 0);self.hideInfo();})(); }
			);
			return this;
		},

		ytplayerEvents : function(state){
			this.state = state;
			switch(this.state) {
				case 0 : this.actions.videoEnded(this); break;
				case 1 : this.actions.videoPlay(this); this.toolbar.states(); break;
				case 3 : this.actions.videoBuffer(this); break;
			}
		},

		actions : {
			play : function(player, button){
				player.states.play = 1;
				player.ytplayer.playVideo();
				(player.state == -1) && player.$loader.show();
			},
			pause : function(player, button){
				player.states.pause = 1;
				player.ytplayer.pauseVideo();
			},
			prev : function(player, button){
				player.$loader.show();
				if (player.track > 0) {
					player.track--;
					player.loadVideo();
				}
			},
			next : function(player, button){
				player.states.play = 1;
				player.$loader.show();
				if (player.track < player.options.playlist.length-1) {
					if (player.options.shuffle) player.randomTrack();
					else player.track++;
					player.loadVideo();
				}
			},
			shuffle : function(player, button){ 
				player.options.shuffle = 1;
				player.states.shuffle = player.states.shuffle && button.toggle ? 0 : 1;
				player.states.play = 1;
				player.actions.next(player, button);
			},
			repeat : function(player, button){
				player.options.repeat = 1;
				player.states.repeat = player.states.repeat && button.toggle ? 0 : 1;
			},
			playlist : function(player, button){
				player.playlist.animate({height: "toggle", opacity: "toggle"}, 550);
			},
			videoPlay : function(player){
				player.states.videoPlay = 1;
				player.states.play = 1;
				player.updateInfo();
				player.router.updateHash();
			},
			videoEnded : function(player){
				(this.options.repeat) && this.next(player);
			},
			videoBuffer : function(player){}
		},

		updateInfo : function(){
			var self = this;
			clearTimeout(this.timer.hideInfo);
			this.$loader.hide();
			(!this.infobar.data('show')) && 
				this.infobar.stop().data('show', 1).css({opacity: 0})
				.html(this.options.playlist[this.track].title)
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
			this.ytplayer.cueVideoById(videoID || this.options.playlist[this.track].id, 0);
		},

		loadVideo : function(videoID){
			var self = this;
			this.infobar.stop().css({opacity: 0});
			this.ytplayer.loadVideoById(videoID || this.options.playlist[this.track].id, 0);
			this.router.updateHash();
		},

		randomTrack : function(){
			this.track = Math.floor(Math.random() * this.options.playlist.length);
		}
	};

})(jQuery);
