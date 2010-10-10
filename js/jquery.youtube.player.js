/*
 * jquery.youtube.js - a jquery youtube player
 * Copyright (c) 2010 Richard Willis
 * MIT license	: http://www.opensource.org/licenses/mit-license.php
 * Project	: http://github.com/badsyntax/jquery-youtube-player
 * Contact	: willis.rh@gmail.com | badsyntax.co.uk
 */

(function($, window, document, undefined){

	$.fn.player = function(method){

		var pluginName = 'jquery-youtube-player', args = arguments;

		return this.each(function(){

			// get plugin reference
			var obj = $.data( this, pluginName );

			// the plugin needs to be initiated before executing public methods
			if ( obj && obj[method] ) {

				// execute a public method
				obj[method].apply( obj, Array.prototype.slice.call( args, 1 ) );
			} 
			// initiate the plugin
			else if ( !obj && ( typeof method === 'object' || ! method ) ) {

				$.data( this, pluginName, new player(this, method, pluginName) );
			}
		});
	}

	function player(element, options, pluginName){

		var self = this;

		this._pluginName = pluginName;

		this.options = $.extend({
			width: 425,			// player width
			height: 356,			// player height
			swfobject: window.swfobject,	// swfobject object
			playlist: {},			// playlist object
			showPlaylist: 1,		// show playlist on plugin init
			showTime: 1,			// show current time and duration in toolbar
			showTitleOverlay: 1,		// show video title overlay text
			videoThumbs: 0,			// show videos as thumbnails in the playlist area
			randomStart: 1,			// show random video on plugin init
			autoStart: 0,			// auto start the video on init
			repeat: 0,			// repeat videos
			shuffle: 0,			// shuffle the play list
			updateHash: 0,			// update the location hash on video play
			playlistHeight: 5,		// height of the playlist
			toolbarAppendTo: false,		// selector or false; element to append the toolbar to
			playlistAppendTo: false,	// selector or false; element to append the playlist to
			videoParams: {			// video <object> params
				allowfullscreen: 'true',
				allowScriptAccess: 'always'
			},
			toolbar: 'play,pause,prev,next,shuffle,repeat,mute,playlistToggle'
		}, options);

		this.element = $( element );

		this.init();
	}

	player.prototype = {
		
		state: -1, timer: {}, router: {}, videoIds: [],

		init : function(obj){

			this.element.addClass('ui-widget');

			this.elements = {
				player: this.element,
				playerVideo: this.element.find('.youtube-player-video'),
				playerObject: this.element.find('.youtube-player-object')
			}
			this.elements.playerObjectClone = this.elements.playerObject.clone();

			this.keys = { video: 0 };

			this.uniqueId( this.elements.playerObject[0], 'youtube-player-' );

			this.loadPlaylist();
		},
		
		initRouter :  function(){

			var self = this, hash = window.location.hash.replace(/.*?#\//, '');

			this.router = {
				hash: hash,
				actions: /\//.test(hash) ? hash.split('/') : ['v'],
				updateHash: function(){

					if (self.options.updateHash) {

						window.location.hash = 
							'/' + self.router.actions[0] + 
							'/' + self.options.playlist.videos[self.keys.video].id;
					}
				}
			};

			switch(this.router.actions[0]){
				case 'v' : 
					this.keys.video = 
						this.router.actions[1] ? $.inArray(this.router.actions[1], this.videoIds) : this.keys.video; 
					break;
				case 'p' : 
					this.keys.video = $.inArray(this.router.actions[1], this.videoIds); 
					this.keys.play = 1; 
					break;
				default : 
					break;
			} 

			return this;
		},

		uniqueId : function(node, prefix){

			prefix = prefix || 'random-';

			var id;
			do {
				id = prefix + Math.floor( Math.random() * 101 ).toString();

			} while( document.getElementById(id) );

			if (node){ 
				node.id = id;
			}

			return id;
		},

		trigger: function(scope, callback, arg){

			var type = typeof callback;

			if ( type === 'string' && this.options[ callback ] && $.isFunction(this.options[ callback ]) ) {

				return this.options[ callback ].apply( scope, arg );

			} else if ( type === 'function' ) {

				return callback.apply( scope, arg );
			}
		},
		
		loadPlaylist: function(playlist, success){

			if ( playlist ) {

				this.options.playlist = playlist;
			}

			this.getPlaylistData(
				function(){ // success

					this.keys.video = this.options.randomStart ? this.randomVideo() : 0;

					// has the flash object been built?
					if (this.youtubePlayer) {

						// reset the playlist and load the first video
						this.createPlaylist();
						this.loadVideo();
						this.showPlaylist();
					} else {

						// build everything and set event handlers
						this
							.createElements()
							.bindPlayerEvents()
							.bindYoutubeEvents()
							.initRouter();
					}

					this.trigger(this, success);
				}, 
				function(){ // error

					var msg = 'There was an error loading the playlist.';

					this.elements.playerObject.html( msg );

					this.trigger(this, 'onError', [msg]);
				}
			);
		},

		getPlaylistData : function(success, error){

			var self = this, playlist = this.options.playlist;

			if (playlist.user || playlist.playlist) {

				function ajaxSuccess(json){

					if (!json) { 

						error.call( self ); 

						return; 
					}

					// replace playlist ID with json array
					self.options.playlist = {
						title: json.feed.title.$t,
						id: playlist,
						videos: []
					};

					$.each(json.feed.entry, function(key, vid){

						self.options.playlist.videos.push({
							id: vid.link[0].href.replace(/^[^v]+v.(.{11}).*/, '$1'), // munge video id from href
							title: vid.title.$t
						});
					});

					self.elements.playerObject.fadeOut(180, function(){

						success.call( self );
					});
				}
				
				var url = playlist.user 
					? 'http://gdata.youtube.com/feeds/base/users/' + playlist.user + '/uploads?v=2&orderby=published&client=ytapi-youtube-profile&max-results=50'
					: 'http://gdata.youtube.com/feeds/api/playlists/' + playlist.playlist;

				this.trigger(this, 'onBeforePlaylistLoaded', [ playlist ]);

				$.ajax({
					type: 'GET',
					url: url,
					data: { alt: 'json' },
					dataType: 'json',
					error: function(){ 
				
						self.trigger(self, 'onAfterPlaylistLoaded', [ playlist ]);

						error.call( self ); 
					},
					success: function(){
						
						self.trigger(self, 'onAfterPlaylistLoaded', [ playlist ]);

						ajaxSuccess.apply( self, arguments );
					}
				});

			} else {
						
				self.trigger(self, 'onAfterPlaylistLoaded', [ playlist ]);

				success.call( self );
			}
		},

		updatePlaylist : function(){

			var self = this;

			(this.elements.playlist) && this.elements.playlist
				.find('li')
				.removeClass('ui-state-active')
				.each(function(key){

					if (self.options.playlist.videos[self.keys.video].id == $(this).data('video').id) {

						var height = $(this).addClass('ui-state-active').outerHeight();

						if ( !self.options.videoThumbs ){

							self.elements.scrollbar.pos = (key * height) - ( Math.floor(self.options.playlistHeight / 2) * height);

							self.elements.playlistScroller.scrollTop(self.elements.scrollbar.pos);
						}

						return false;
					}
				});
		},

		showPlaylist : function() {

			this.elements.playlistContainer.show();

			var scrollerHeight = this.elements.playlist.height(),
				videoHeight = this.elements.playlist.find('li:first').outerHeight(),
				newHeight = videoHeight * this.options.playlistHeight;

			this.elements.playlistContainer.hide();

			this.elements.playlistScroller.height( newHeight < scrollerHeight ? newHeight : scrollerHeight );

			if (this.options.showPlaylist) {

				this.elements.playlistContainer.animate({
					height: 'toggle', 
					opacity: 'toggle'
				}, 550);
			}
		},

		bindYoutubeEvents : function(){

			var self = this;

			this.youtubePlayerEvents = {

				ready : function(){

					self.youtubePlayer = self.elements.player.find('object:first').get(0);

					self.youtubePlayer.addEventListener('onStateChange', '_youtubeevents');

					self.youtubePlayer.addEventListener('onError', '_youtubeevents');

					self.cueVideo();

					self.elements.toolbar.container.animate({opacity: 1}, 400, function(){

						self.trigger(self, 'onReady', arguments);
					});

					self.showPlaylist();
			
					if (self.keys.play) {

						self.playVideo();
					}
				},
				videoPlay : function(){

					self.updatePlaylist();

					self.router.updateHash();

					buttons.play.element.data('state', 1);

					self.elements.toolbar.updateStates();

					self.elements.infobar.css({opacity: 0})

					self.updateInfo(320);

					self.updateTime();

					self.trigger(this, 'onVideoPlay', arguments);
				},
				videoEnded : function(){

					if (self.options.repeat) {

						self.nextVideo();
					}
				},
				error: function(state){

					switch(state){
						case 100:
							msg = 'This video has been removed from Youtube.';
							break;
						case 101:
						case 150:
							msg = 'This video does not allow playback outside of Youtube.';
							break;
						default:
							msg = 'Unknown error';
					}

					if (self.trigger(this, 'onError', [msg]) === undefined){

						alert( 'There was an error loading this video. ' + msg );
					}
				},
				videoBuffer : function(){

					self.trigger(this, 'onBuffer', arguments); 
				}
			};

			window.onYouTubePlayerReady = function(){ 

				self.youtubeEventHandler(9); 
			};

			window._youtubeevents = function(state){ 

				self.youtubeEventHandler(state); 
			};

			return this;
		},

		bindPlayerEvents : function(){

			var self = this;

			this.elements.playerVideo
				.unbind('mouseenter.player mouseleave.player')
				.bind('mouseenter.player', function(){ 

					self.updateInfo(); 
				})
				.bind('mouseleave.player', function(){

					self.hideInfo();
				});

			return this;
		},

		youtubeEventHandler : function(state){

			if (state != this.state) {

				switch(this.state = state) {
					case 0	: 
						this.youtubePlayerEvents.videoEnded(); 
						break;
					case 1 : 
						this.youtubePlayerEvents.videoPlay();
						break;
					case 3 : 
						this.youtubePlayerEvents.videoBuffer(); 
						break;
					case 100: 
					case 101:
					case 150:
						this.youtubePlayerEvents.error( state );
						break;
					case 9 : 
						this.youtubePlayerEvents.ready();
						break;
				}
			}
		},
				
		loadVideo : function(videoID, title){

			this.elements.infobar.stop().css({opacity: 0});

			if (videoID) {

				// reset the playlist
				this.options.playlist.videos = title ? [{
					id: videoID,
					title: title
				}] : [];

				this.createPlaylist();

				this.showPlaylist();
				
				// reset the playlist key
				this.keys.video = $.inArray(videoID, this.videoIds);
			}

			// get video youtube ID
			videoID = videoID || this.options.playlist.videos[this.keys.video].id;

			// (videoID, startSeconds, suggestQuality)
			this.youtubePlayer.loadVideoById(videoID, 0);

			this.router.updateHash();

			// TODO: need to determine if video has loaded successfully 
			this.trigger(this, 'onVideoLoaded', [ videoID ]);
		},
			
		pauseVideo : function(){
			
			this.youtubePlayer.pauseVideo();
		},

		shufflePlaylist : function(){
	
			this.randomVideo();

			this.playVideo();
		},

		muteVideo : function(button){

			button.element.data('state') ? this.youtubePlayer.mute() : this.youtubePlayer.unMute();
		},
		
		repeat : function(){

			this.options.repeat = 1;
		},
				
		playVideo : function(){
		
			this.youtubePlayer.playVideo();
		},

		cueVideo : function(videoID){

			videoID = videoID || this.options.playlist.videos[this.keys.video].id;

			this.trigger(this, 'onVideoCue', [ videoID ]);

			return this.youtubePlayer.cueVideoById( videoID, 0);
		},

		randomVideo : function(){

			this.keys.video = Math.floor(Math.random() * this.options.playlist.videos.length);

			return this.keys.video;
		},

		prevVideo : function(){

			if (this.keys.video > 0) {

				this.keys.video--;

				buttons.play.element.data('state', 0);

				this.loadVideo();

				this.playVideo();
			}
		},

		nextVideo : function(){

			if (this.keys.video < this.options.playlist.videos.length-1) {

				if (this.options.shuffle) {

					this.randomVideo();
				} else {

					this.keys.video++;
				}

				buttons.play.element.data('state', 0);
				
				this.loadVideo();

				this.playVideo();
			}
		},
		
		playlistToggle : function(button){

			(this.elements.playlistContainer.find('li').length) &&
				this.elements
					.playlistContainer
					.animate({
						height: 'toggle', 
						opacity: 'toggle'
					}, 550);
		},

		fullscreen: function(button){

			this.youtubePlayer.setSize(900, 900);	
		},

		updateInfo : function(timeout, text){

			if (!this.options.showTitleOverlay) return;

			var self = this;

			if (
				( buttons.play.element.data('state') || buttons.pause.element.data('state') ) 
				&& this.elements.infobar.css('opacity') < 1
			) {

				clearTimeout(this.timer.hideInfo);

				this.timer.showInfo = setTimeout(function(){

					self.elements.infobar
						.stop(true, true)
						.css({ 
							opacity: 0 
						})
						.html(text || ( self.options.playlist.videos[self.keys.video] ? self.options.playlist.videos[self.keys.video].title : ''))
						.unbind('click')
						.click(function(){ 

							window.open(self.youtubePlayer.getVideoUrl()); 
						})
						.animate({ opacity: 1 }, 180, function(){

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

			this.elements.infobar
				.stop(true, true)
				.animate({
					opacity: 0
				}, 120);
		},

		updateTime : function(){

			if (!this.options.showTime) return;

			var self = this, duration = this.youtubePlayer.getDuration();

			function timeFormat(seconds) {

				seconds = Number(seconds);

				var h = Math.floor(seconds / 3600),
					m = Math.floor(seconds % 3600 / 60),
					s = Math.floor(seconds % 3600 % 60);

				return ((h > 0 ? h + ':' : '') + (m > 0 ? (h > 0 && m < 10 ? '0' : '') + m + ':' : '0:') + (s < 10 ? '0' : '') + s);
			}

			this.elements.toolbar.timeDuration.html( ' / ' + timeFormat( duration ));

			this.elements.toolbar.time.fadeIn();

			this.timeInterval = setInterval(function(){

				if (!self.youtubePlayer.getCurrentTime) {

					clearInterval( self.timeInterval );

				} else {

					var currentTime = self.youtubePlayer.getCurrentTime();

					self.elements.toolbar.timeCurrent.html( timeFormat(currentTime) );
				}
			}, 100);
		},

		createElements : function(){

			return this
				.createPlayer()
				.createToolbar()
				.createInfobar()
				.createPlaylist();
		},

		createPlayer : function(){

			this.elements.player.width( parseInt( this.options.width ) );

			this.elements.playerVideo.height( parseInt( this.options.height ) );

			this.options.swfobject.embedSWF(
				'http://www.youtube.com/apiplayer?enablejsapi=1&version=3&playerapiid=youtube&hd=1&showinfo=0', 
				this.elements.playerObject[0].id, '100%', '100%', '8', null, null, this.options.videoParams
			);

			return this;
		},

		createToolbar : function(){

			var self = this;

			this.elements.toolbar = {
				container: 
					$('<ul class="youtube-player-toolbar ui-widget ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all">')
					.css('opacity', 0),
				updateStates : function(){

					$.each(self.options.toolbar.split(','), function(key, val) {

						var button = buttons[val];

						if (!button) return true;

						button.element.removeClass('ui-state-active');

						(button.element.data('state')) &&
						(button.toggle) && 
						button.element.addClass('ui-state-active');

						if (button.element.data('state') && button.toggleButton){

							button.element.trigger('on');
						}
					});
				}
			};

			$.each(this.options.toolbar.split(','), function(key, val) {

				var button = buttons[val];

				if (!button) return true;

				buttons[val].element =
					$('<li class="ui-state-default ui-corner-all">')
					.append('<span class="ui-icon ' + button.icon + '">')
					.attr('title', button.text)
					.data('button', button)
					.bind('mouseenter mouseleave', function(){

						$(this).toggleClass('ui-state-hover'); 
					})
					.bind('off', function(){

						var button = $(this).data('button'), toggle = 1;
						
						$(this).data('toggle', toggle);
						$(this).data('state', 0);

						button.element.find('.ui-icon')
							.removeClass( button.toggleButton.icon )
							.addClass( button.icon );
		
						button.element.attr('title', button.text)

						button.toggleButton.action.call(self, button)

					})
					.bind('on', function(){

						var button = $(this).data('button'), toggle = 0;
						
						$(this).data('toggle', toggle);
						$(this).data('state', 1);

						button.element.find('.ui-icon')
							.removeClass( button.icon )
							.addClass( button.toggleButton.icon );

						button.element.attr('title', button.toggleButton.text)

						button.action.call(self, button)
					})
					.bind('toggle', function(){
						
						var toggle = $(this).data('toggle');

						( toggle || toggle == undefined) ? $(this).trigger('on') : $(this).trigger('off');
					})
					.click(function(){

						var button = $(this).data('button'), 
							state = $(this).data('state');

						if (button.toggleButton) {
							
							$(this).trigger('toggle');

						} else {
						
							$(this).data('state', state && button.toggle ? 0 : 1);

							self.elements.toolbar.updateStates();

							button.action.call(self, button);
						}
					})
					.appendTo(self.elements.toolbar.container);

			});

			this.elements.toolbar.time = $('<li class="youtube-player-time">').appendTo(this.elements.toolbar.container);
			this.elements.toolbar.timeCurrent = $('<span>').html('0:00').appendTo(this.elements.toolbar.time);
			this.elements.toolbar.timeDuration = $('<span>').appendTo(this.elements.toolbar.time);

			if (this.options.toolbarAppendTo) {

			
				this.elements.toolbar.container.appendTo( this.options.toolbarAppendTo );
			} else {

				this.elements.playerVideo.after( this.elements.toolbar.container );
			}

			return this;
		},

		createInfobar : function(){

			this.elements.infobar = $('<div>').addClass('youtube-player-infobar ui-widget-content ui-corner-all').css('opacity', 0);

			this.elements.playerVideo.prepend(this.elements.infobar);

			return this;
		},

		createPlaylist : function(){

			var self = this;

			function videoClickHandler(){

				var videoData = $(this).data('video');

				if (!videoData) return;

				self.keys.video = $.inArray( videoData.id, self.videoIds );

				buttons.play.element.data('state', 0);
				
				self.updatePlaylist();

				self.loadVideo();
				
				self.playVideo();
			}

			this.videoIds = [];

			if (this.options.playlistBuilder) {

				// custom playlist
			
				$.each(this.options.playlist.videos, function(){

					self.videoIds.push( this.id );
				});

				var playlist = this.options.playlistBuilder.call(this, this.options.playlist.videos);

				playlist
					.items
					.click(function(){

						videoClickHandler.apply(this, arguments);
					});

				this.elements.playlistContainer = playlist.container;

			} else {

				// default playlist

				function scrollup(){

					self.elements.scrollbar.pos = 
						self.elements.scrollbar.pos > self.elements.playlist.find('li:first').height() ? 
						self.elements.scrollbar.pos - self.elements.playlist.find('li:first').height() : 
						0;

					self.elements.playlistScroller.scrollTop(self.elements.scrollbar.pos);
				}

				function scrolldown(){

					self.elements.scrollbar.pos = 
						self.elements.scrollbar.pos < self.elements.playlist.outerHeight() - self.elements.playlistScroller.outerHeight() ? 
						self.elements.scrollbar.pos + self.elements.playlist.find('li:first').height() : 
						self.elements.scrollbar.pos;

					self.elements.playlistScroller.scrollTop(self.elements.scrollbar.pos);
				}

				this.elements.playlistScroller = $('<div class="youtube-player-playlist-scroller">');

				($.fn.mousewheel) &&
					this.elements.playlistScroller.unbind().bind('mousewheel', function(event, delta) {
						delta > 0 ? scrollup() : scrolldown();
					});

				this.elements.playlistContainer = this.elements.playlistContainer || $('<div>').addClass('youtube-player-playlist-container ui-widget-content ui-corner-all');

				this.elements.playlistContainer.empty();

				this.elements.playlist = $('<ol>').addClass('youtube-player-playlist ui-helper-reset');

				this.elements.scrollbar = {
					bar : 
						$('<div>')
							.addClass('youtube-player-playlist-scrollbar ui-widget ui-widget-content ui-corner-all')
							.appendTo(this.elements.playlistContainer),
					up : 
						$('<span>')
							.addClass('youtube-player-playlist-scrollbar-up ui-icon ui-icon-circle-triangle-n')
							.click(function(){
							
								scrollup();
							})
							.appendTo(this.elements.playlistContainer),
					down : 
						$('<span>')
							.addClass('youtube-player-playlist-scrollbar-down ui-icon ui-icon-circle-triangle-s')
							.click(function(){ 

								scrolldown();
							})
							.appendTo(this.elements.playlistContainer),
					pos : 0
				}

				this.elements.playlist.empty();

				$.each(this.options.playlist.videos, function(){

					self.videoIds.push(this.id);

					$('<li>')
						.data('video', this)
						.append( self.options.videoThumbs ? '<img alt="' + this.title + '" title="' + this.title + '" src="http://img.youtube.com/vi/' + this.id + '/2.jpg" />' : this.title)
						.addClass('ui-state-default')
						.addClass( self.options.videoThumbs ? 'youtube-player-thumb' : '' )
						.bind('mouseenter mouseleave', function(){

							$( this ).toggleClass( 'ui-state-hover' );
						})
						.click(function(){
			
							videoClickHandler.apply(this, arguments);
						})
						.appendTo(self.elements.playlist);
				});
					
				this.elements.playlistContainer.append( this.elements.playlistScroller.append(this.elements.playlist));

				if (this.options.playlistAppendTo) {

					this.elements.playlistContainer.appendTo( this.options.playlistAppendTo );

				} else {

					this.elements.toolbar.container.after( this.elements.playlistContainer );
				}
			}

			return this;
		},

		destroy: function(){

			clearInterval( this.timeInterval );

			this.element.removeClass('ui-widget').removeAttr('style');

			this.elements.playerVideo.removeAttr('style');

			this.elements.infobar.remove();

			this.elements.playlistContainer.remove();

			this.elements.toolbar.container.remove();

			this.options.swfobject.removeSWF(this.elements.playerObject[0].id);
			
			this.elements.playerObjectClone.appendTo( this.elements.playerVideo );

			$.removeData( this.element[0], this._pluginName );
		}
	};
		
	var buttons = {

		play: { 
			text: 'Play',
			icon: 'ui-icon-play', 
			toggleButton: {
				text: 'Pause', 
				icon: 'ui-icon-pause', 
				action: function(){
							
					this.pauseVideo();
				}
			},
			action: function(){

				this.playVideo();
			}
		},
		prev: { 
			text: 'Prev', 
			icon: 'ui-icon-seek-prev',
			action: function(){

				this.prevVideo();
			}
		},
		next: { 
			text: 'Next', 
			icon: 'ui-icon-seek-next',
			action: function(){
				
				this.nextVideo();
			}
		},
		shuffle: { 
			text: 'Shuffle/Random', 
			icon: 'ui-icon-shuffle', 
			toggle: 1,
			action: function(){
				
				this.shufflePlaylist();
			}
		},
		repeat: { 
			text: 'Repeat playlist',
			icon: 'ui-icon-refresh', 
			toggle: 1,
			action: function(){
				
				this.repeat();
			}
		},
		mute: { 
			text: 'Mute', 
			icon: 'ui-icon-volume-on', 
			toggle: 1,
			action: function(button){

				this.muteVideo(button);
			}
		},
		fullscreen: {
			text: 'Full screen',
			icon: 'ui-icon-arrow-4-diag',
			toggle: 1,
			action: function(){

				this.fullscreen();
			}
		},
		playlistToggle: { 
			text: 'Toggle playlist', 
			icon: 'ui-icon-script',
			action: function(){

				this.playlistToggle();
			}
		}
	};

})(window.jQuery, window, document);
