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
			swfobject: window.swfobject || false,
			playlist: [],
			showPlaylist: 1,
			randomStart: 0,
			shuffle: 0
		}, options || {});
		this.$player = $(obj);
		this.ytplayer = this.$player.find("#player-object").get(0);
		this.trackNumber = 0;
		this.timer = {};
		this.init();
	}

	player.prototype = {

		init : function(){
			this.trackNumber = this.options.randomStart ? Math.floor(Math.random()*this.options.playlist.length) : 0;
			this.createElements();
		},

		createElements : function(){
			this
			.createPlayer()
			.createToolbar()
			.createInfobar();
		},
		
		createPlayer : function(){
			var params = { 
				allowScriptAccess: "always" 
			};
			(this.options.swfobject) && 
			this.options.swfobject.embedSWF(
				"http://www.youtube.com/apiplayer?enablejsapi=1&version=3&playerapiid=ytplayer&hd=1&showinfo=0", 
				this.ytplayer.id, this.options.width, this.options.height, "8", null, null, params
			);
			return this;
		},

		createToolbar : function(){
			var self = this;
			this.toolbar = {
				container: $('<ul id="player-toolbar" class="ui-widget ui-helper-clearfix ui-widget-header ui-corner-all"></ul>'),
				buttons : {
					play: {
						text: 'Play',
						classname: 'ui-icon-play'
					},
					pause: {
						text: 'Pause',
						classname: 'ui-icon-pause'
					},
					prev: {
						text: 'Prev',
						classname: 'ui-icon-seek-prev'
					},
					next: {
						text: 'Next',
						classname: 'ui-icon-seek-next'
					},
					shuffle: {
						text: 'Shuffle/Random',
						classname: 'ui-icon-shuffle'
					},
					volume: {
						text: 'Volume',
						classname: 'ui-icon-volume-on'
					}
				}
			}
			for(var button in this.toolbar.buttons) {
				this.toolbar.buttons[button].obj = 
				$('<li class="ui-state-default ui-corner-all"></li>')
				.append('<span class="ui-icon '+this.toolbar.buttons[button].classname+'"></span></li>')
				.attr('title', this.toolbar.buttons[button].text).data('actionName', button)
				.hover(
					function(){ $(this).addClass("ui-state-hover"); },
					function(){ $(this).removeClass("ui-state-hover"); }
				)
				.click(function(){
					self.toolbar.container.find(".ui-state-active").removeClass("ui-state-active");
					self.actions[$(this).addClass("ui-state-active").data("actionName")](self, this);
				});
				this.toolbar.container.append(this.toolbar.buttons[button].obj);
			}
			this.$player.find("#player-video").after(this.toolbar.container);
			return this;
		},

		createInfobar : function(){
			this.infobar = $('<div id="player-infobar"></div>');
			this.$player.find("#player-video").prepend(this.infobar);
		},

		onReady : function(){
			var self = this;
			window._ytplayerevents = function(state){
				self.events(state);
			};
			this.ytplayer = this.$player.find("object:first").get(0);
			this.ytplayer.addEventListener("onStateChange", "_ytplayerevents");
			this.toolbar.container.fadeIn(400);
			this.cueVideo();
		},

		events : function(state){
			switch(state) {
				case 1 : this.actions.videoPlay(this); break;
			}
		},

		actions : {
			videoPlay : function(player){
				player.updateInfo();
			},
			play : function(player, button){
				player.ytplayer.playVideo();
			},
			pause : function(player, button){
				player.ytplayer.pauseVideo();
			},
			prev : function(player, button){
				if (player.trackNumber > 0) {
					player.trackNumber--;
					player.loadVideo();
					player.toolbar.buttons.play.obj.addClass("ui-state-active");
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
					player.toolbar.buttons.play.obj.addClass("ui-state-active");
				}
				$(button).removeClass("ui-state-active");
			},
			shuffle : function(player, button){ 
				player.options.shuffle = 1;
				player.actions.next(player, button);
			}
		},

		updateInfo : function(){
			console.log('update info');
			var self = this;
			clearTimeout(this.timer.hideInfo);
			this.infobar.stop().css({opacity: 0}).html(this.options.playlist[this.trackNumber].title).animate({opacity: 1}, 400, function(){
				self.timer.hideInfo = setTimeout(function(){
					self.infobar.animate({opacity: 0});
				}, 6000);
			});
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
			this.trackNumber = Math.floor(Math.random()*this.options.playlist.length);
		}
	};

})(jQuery);
