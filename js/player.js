
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
		trackNumber: 0
	}, options || {});
	this.$player = $(obj);
	this.ytplayer = this.$player.find("#player-object").get(0);
	this.init();
}

player.prototype = {

	init : function(){
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
					classname: 'ui-icon-play',
					action : function(player){
						player.playVideo();
					}
				},
				pause: {
					text: 'Pause',
					classname: 'ui-icon-pause',
					action : function(player){
						player.pauseVideo();
					}
				},
				prev: {
					text: 'Prev',
					classname: 'ui-icon-seek-prev',
					action : function(player, button){
						if (self.options.trackNumber > 0) {
							self.options.trackNumber--;
							self.loadVideo();
							self.toolbar.buttons.play.obj.addClass("ui-state-active");
						}
						$(button).removeClass("ui-state-active");
					}
				},
				next: {
					text: 'Next',
					classname: 'ui-icon-seek-next',
					action : function(player, button){
						if (self.options.trackNumber < self.options.playlist.length-1) {
							self.options.trackNumber++;
							self.loadVideo();
							self.toolbar.buttons.play.obj.addClass("ui-state-active");
						}
						$(button).removeClass("ui-state-active");
					}
				},
				volume: {
					text: 'Volume',
					classname: 'ui-icon-volume-on',
					action : function(player){

					}
				}
			}
		}
		for(var button in this.toolbar.buttons) {
			this.toolbar.buttons[button].obj = 
				$('<li class="ui-state-default ui-corner-all"></li>')
				.append('<span class="ui-icon '+this.toolbar.buttons[button].classname+'"></span></li>')
				.attr('title', this.toolbar.buttons[button].text)
				.data('button', this.toolbar.buttons[button])
				.hover(
					function(){ $(this).addClass("ui-state-hover"); },
					function(){ $(this).removeClass("ui-state-hover"); }
				)
				.click(function(){
					self.toolbar.container
					.find(".ui-state-active")
					.removeClass("ui-state-active");
					$(this)
					.addClass("ui-state-active")
					.data("button")
					.action(self.ytplayer, this);
				});
			this.toolbar.container.append(this.toolbar.buttons[button].obj);
		}
		this.$player.find("#player-video").after(this.toolbar.container);
		return this;
	},
	createInfobar : function(){
		this.infobar = $('<div id="player-infobar"></div>');
		this.toolbar.container.after(this.infobar);
	},
	onReady : function(){
		this.ytplayer = this.$player.find("object:first").get(0);
		this.toolbar.container.fadeIn(400);
		this.cueVideo();
	},
	updateInfo : function(){
		this.infobar.hide().html(this.options.playlist[this.options.trackNumber].title).fadeIn(400);
	},
	cueVideo : function(videoID){
		this.ytplayer.cueVideoById(videoID || this.options.playlist[this.options.trackNumber].id, 0);
		this.updateInfo();
	},
	loadVideo : function(videoID){
		this.ytplayer.loadVideoById(videoID || this.options.playlist[this.options.trackNumber].id, 0);
		this.updateInfo();
	}
};
