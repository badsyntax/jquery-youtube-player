/*
 * jquery.ytplayer.js - a jquery youtube player
 * Copyright (c) 2010 Richard Willis
 * MIT license  : http://www.opensource.org/licenses/mit-license.php
 * Project      : http://jquery-youtube-player.googlecode.com
 * Contact      : willis.rh@gmail.com
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
		this.trackNumber = 0;
		this.timer = {};
		this.init();
	}

	player.prototype = {

		init : function(){
			this.trackNumber = this.options.randomStart ? Math.floor(Math.random() * this.options.playlist.length) : 0;
			this
			.createElements()
			.bindEvents();
		},

		createElements : function(){
			this
			.createPlayer()
			.createToolbar()
			.createInfobar()
			.createPlaylist();
			return this;
		},
		
		createPlayer : function(){
			this.$player.css({width: this.options.width+"px"});
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
						self.toolbar.buttons[state].obj.addClass("ui-state-active");
					}
				},
				buttons : {
					play: { text: 'Play', classname: 'ui-icon-play' },
					pause: { text: 'Pause', classname: 'ui-icon-pause' },
					prev: { text: 'Prev', classname: 'ui-icon-seek-prev' },
					next: { text: 'Next', classname: 'ui-icon-seek-next' },
					shuffle: { text: 'Shuffle/Random', classname: 'ui-icon-shuffle' },
					repeat: { text: 'Repeat playlist', classname: 'ui-icon-refresh', disabled: 1 },
					volume: { text: 'Volume', classname: 'ui-icon-volume-on', disabled: 1 },
					playlist: { text: 'Toggle playlist', classname: 'ui-icon-script' }
				}
			}
			for(var button in this.toolbar.buttons) {
				if (this.toolbar.buttons[button].disabled) continue;
				this.toolbar.buttons[button].obj = $('<li class="ui-state-default ui-corner-all"></li>')
				.append('<span class="ui-icon '+this.toolbar.buttons[button].classname+'"></span></li>')
				.attr('title', this.toolbar.buttons[button].text).data('actionName', button)
				.hover(
					function(){ $(this).addClass("ui-state-hover"); },
					function(){ $(this).removeClass("ui-state-hover"); }
				)
				.click(function(){
					self.actions[$(this).addClass("ui-state-active").data("actionName")](self, this);
					self.toolbar.states();
				}).appendTo(this.toolbar.container);
			}
			this.$playerVideo.after(this.toolbar.container);
			return this;
		},

		createInfobar : function(){
			this.infobar = $('<div id="player-infobar"></div>');
			this.$playerVideo.prepend(this.infobar);
			return this;
		},

		createPlaylist : function(){
			var self = this;
			this._trackIds = [];
			this.playlist = $('<ul id="player-playlist"></ul>');
			for(var track in this.options.playlist) {
				this._trackIds.push(this.options.playlist[track].id);
				$('<li></li>')
				.data("track", this.options.playlist[track])
				.append('<span class="ui-icon ui-icon-triangle-1-e">')
				.append(this.options.playlist[track].title)
				.click(function(){
					self.trackNumber = $.inArray($(this).data("track").id, self._trackIds);
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

		bindEvents : function(){
			var self = this;
			this.$playerVideo.hover(
				function(){ (self.states.videoPlay) && self.updateInfo(); },
				function(){ (self.states.videoPlay) && self.hideInfo(); }
			);
			return this;
		},

		ytplayerEvents : function(state){
			switch(state) {
				case 1 : this.actions.videoPlay(this); break;
			}
		},

		states : { },

		actions : {
			videoPlay : function(player){
				player.updateInfo();
				player.states.videoPlay = 1;
			},
			play : function(player, button){
				player.ytplayer.playVideo();
				player.states.play = 1;
			},
			pause : function(player, button){
				player.ytplayer.pauseVideo();
				player.states.pause = 1;
			},
			prev : function(player, button){
				if (player.trackNumber > 0) {
					player.trackNumber--;
					player.loadVideo();
				}
			},
			next : function(player, button){
				if (player.trackNumber < player.options.playlist.length-1) {
					if (player.options.shuffle) {
						player.randomTrack();
					} else {
						player.trackNumber++;
					}
					player.loadVideo();
				}
				player.states.play = 1;
			},
			shuffle : function(player, button){ 
				player.actions.next(player, button);
				player.options.shuffle = 2;
			},
			playlist : function(player, button){
				player.playlist.animate({height: "toggle", opacity: "toggle"}, 550);
			}
		},

		updateInfo : function(){
			var self = this;
			clearTimeout(this.timer.hideInfo);
			this.infobar.stop().css({opacity: 0}).html(this.options.playlist[this.trackNumber].title).animate({opacity: 1}, 400, function(){
				self.timer.hideInfo = setTimeout(function(){
					self.hideInfo();
				}, 6000);
			});
		},

		hideInfo : function(){
			this.infobar.stop().animate({opacity: 0});
		},

		cueVideo : function(videoID){
			this.ytplayer.cueVideoById(videoID || this.options.playlist[this.trackNumber].id, 0);
		},

		loadVideo : function(videoID){
			var self = this;
			this.infobar.stop().css({opacity: 0});
			this.ytplayer.loadVideoById(videoID || this.options.playlist[this.trackNumber].id, 0);
		},

		randomTrack : function(){
			this.trackNumber = Math.floor(Math.random() * this.options.playlist.length);
		}
	};

})(jQuery);
