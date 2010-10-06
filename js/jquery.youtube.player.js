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
			if ( obj && obj.api && obj.api[method] ) {

				// execute a public method
				obj.api[method].apply( obj, Array.prototype.slice.call( args, 1 ) );
			} 
			// initiate the plugin
			else if ( !obj && ( typeof method === 'object' || ! method ) ) {

				$.data( this, pluginName, new player(this, method) );
			}
		});
	}

	function player(element, options){

		var self = this;

		this.options = $.extend({
			width: 425,			// player width
			height: 356,			// player height
			swfobject: window.swfobject,	// swfobject object
			playlist: {},			// playlist object
			showPlaylist: 1,		// show playlist on plugin init
			randomStart: 1,			// show random video on plugin init
			autoStart: 0,			// auto start the video on init
			repeat: 0,			// repeat videos
			shuffle: 0,			// shuffle the play list
			updateHash: 0,			// update the location hash on video play
			playlistHeight: 5,		// height of the playlist
			videoParams: { 			// video <object> params
				allowfullscreen: 'true',
				allowScriptAccess: 'always'
			},
			toolbar: {
				buttons : {
					play: { 
						text: 'Play', 
						icon: 'ui-icon-play', 
						toggleButton: 'pause'
					},
					pause: { 
						text: 'Pause', 
						icon: 'ui-icon-pause', 
						toggleButton: 'play' 
					},
					prev: { 
						text: 'Prev', 
						icon: 'ui-icon-seek-prev' 
					},
					next: { 
						text: 'Next', 
						icon: 'ui-icon-seek-next' 
					},
					shuffle: { 
						text: 'Shuffle/Random', 
						icon: 'ui-icon-shuffle', 
						toggle: 1
					},
					repeat: { 
						text: 'Repeat playlist',
						icon: 'ui-icon-refresh', 
						toggle: 1 
					},
					mute: { 
						text: 'Mute', 
						icon: 'ui-icon-volume-on', 
						toggle: 1 
					},
					fullscreen: {
						text:' Full screen',
						icon: 'ui-icon-arrow-4-diag',
						toggle: 1,
						disabled: 1
					},
					playlistToggle: { 
						text: 'Toggle playlist', 
						icon: 'ui-icon-script'
					},
					playlists: { 
						text: 'Toggle playlists', 
						icon: 'ui-icon-video', 
						toggle: 1, 
						disabled: 1 
					}
				}
			}
		}, options);

		this.element = $( element );

		// public event API
		this.api = {

			play : function(){

				return self.playVideo();
			},
			loadVideo : function(videoID){

				return self.loadVideo(videoID);
			},
			cueVideo : function(videoID){

				return self.cueVideo(videoID);
			},
			randomVideo : function(){

				return self.randomVideo();
			},
			pause : function(){

				return self.pauseVideo();
			},
			prev : function(){

				return self.prevVideo();
			},
			next : function(){

				return self.nextVideo();
			},
			shuffle : function(){

				return self.shufflePlaylist();
			},
			repeat : function(){

				self.options.repeat = 1;
			},
			mute : function(button){

				return self.muteVideo(button);
			},
			loadPlaylist: function(playlist){

				self.loadPlaylist(playlist, function(){

					self.cueVideo();
				});
			},
			playlistToggle : function(button){

				self.elements
					.playlistContainer
					.animate({
						height: 'toggle', 
						opacity: 'toggle'
					}, 550);
			},
			fullscreen: function(button){

				self.youtubePlayer.setSize(900, 900);	
			}
		};
			
		this.youtubePlayerEvents = {

			ready : function(){

				self.youtubePlayer = self.elements.player.find('object:first').get(0);

				self.youtubePlayer.addEventListener('onStateChange', '_youtubeevents');

				self.youtubePlayer.addEventListener('onError', '_youtubeevents');

				self.cueVideo();

				self.elements.toolbar.container.animate({opacity: 1}, 400, function(){

					self.trigger(self.api, 'onready', arguments);
				});

				self.elements.playlistContainer.show();

				var scrollerHeight = self.elements.playlist.height(),
					videoHeight = self.elements.playlist.find('li:first').outerHeight(),
					newHeight = videoHeight * self.options.playlistHeight;

				self.elements.playlistContainer.hide();

				self.elements.playlistScroller.height( newHeight < scrollerHeight ? newHeight : scrollerHeight );

				if (self.options.showPlaylist) {

					self.elements.playlistContainer.animate({
						height: 'toggle', 
						opacity: 'toggle'
					}, 550);
				}

				if (self.keys.play) {

					self.playVideo();
				}
			},
			videoPlay : function(){

				self.updatePlaylist();

				self.router.updateHash();

				self.elements.toolbar.buttons.play.element.data('state', 1);

				self.elements.toolbar.updateStates();

				self.elements.infobar.css({opacity: 0})

				self.updateInfo(320);

				self.trigger(this, 'onVideoPlay', arguments);
			},
			videoEnded : function(){

				if (self.options.repeat) {

					self.api.next();
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

				self.trigger(this, 'onerror', [msg]);

				alert( 'Sorry, there was an error loading this video. ' + msg );
			},
			videoBuffer : function(){

				self.trigger(this, 'onbuffer', arguments); 
			}
		};
	
		this.init();
	}

	player.prototype = {
		
		state: -1, timer: {}, router: {}, videoIds: [], elements: {},

		init : function(obj){

			this.element.addClass('ui-widget');

			this.elements.player = this.element;

			this.elements.playerVideo = this.element.find('.youtube-player-video');

			this.elements.playerObject = this.element.find('.youtube-player-object');

			this.keys = {
				video: 0
			};

			this.uniqueId( this.elements.playerObject[0], 'youtube-player-' );

			this.loadPlaylist();
		},

		loadPlaylist: function(playlist, success){

			if ( playlist ) {

				this.options.playlist = playlist;
			}

			this.getPlaylistData(
				function(){ // success

					this.keys.video = this.options.randomStart ? this.randomVideo() : 0;

					this
						.createElements()
						.bindPlayerEvents()
						.bindYoutubeEvents()
						.initRouter();

					this.trigger(this, success);
				}, 
				function(){ // error

					this.elements.playerObject
						.html('There was an error loading the playlist.')
						.removeClass('playlist-loading');
				}
			);
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

				this.options[ callback ].apply( scope, arg );

			} else if ( type === 'function' ) {

				callback.apply( scope, arg );
			}
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

				$.ajax({
					type: 'GET',
					url: url,
					data: { alt: 'json' },
					dataType: 'json',
					error: function(){ 

						error.call( self ); 
					},
					success: function(){

						ajaxSuccess.apply( self, arguments );
					}
				});

			} else {

				success.call( self );
			}
		},

		updatePlaylist : function(){

			var self = this;

			this.elements.playlist
				.find('li')
				.removeClass('ui-state-active')
				.each(function(key){

					if (self.options.playlist.videos[self.keys.video].id == $(this).data('video').id) {

						var height = $(this).addClass('ui-state-active').outerHeight();

						self.elements.scrollbar.pos = (key * height) - ( Math.floor(self.options.playlistHeight / 2) * height);

						self.elements.playlistScroller.scrollTop(self.elements.scrollbar.pos);

						return false;
					}
				});
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
		},
		
		bindYoutubeEvents : function(){

			if (window.onYouTubePlayerReady) return this;

			var self = this;

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
				
		loadVideo : function(videoID){

			var self = this;

			self.elements.infobar.stop().css({opacity: 0});

			if (videoID) {

				self.keys.video = $.inArray(videoID, self.videoIds);
			}

			self.youtubePlayer.loadVideoById(videoID || self.options.playlist.videos[self.keys.video].id, 0);

			self.router.updateHash();
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
				
		playVideo : function(){
		
			this.loadVideo();

			this.youtubePlayer.playVideo();
		},

		cueVideo : function(videoID){

			return this.youtubePlayer.cueVideoById(
				videoID || this.options.playlist.videos[this.keys.video].id, 
				0
			);
		},

		randomVideo : function(){

			this.keys.video = Math.floor(Math.random() * this.options.playlist.videos.length);

			return this.keys.video;
		},

		prevVideo : function(){

			if (this.keys.video > 0) {

				this.keys.video--;

				this.elements.toolbar.buttons.play.element.data('state', 0);

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

				this.elements.toolbar.buttons.play.element.data('state', 0);

				this.playVideo();
			}
		},

		updateInfo : function(timeout, text){

			var self = this;

			if (
				( this.elements.toolbar.buttons.play.element.data('state') || this.elements.toolbar.buttons.pause.element.data('state') ) 
				&& this.elements.infobar.css('opacity') < 1
			) {

				clearTimeout(this.timer.hideInfo);

				this.timer.showInfo = setTimeout(function(){

					self.elements.infobar
						.stop(true, true)
						.css({ 
							opacity: 0 
						})
						.html(text || self.options.playlist.videos[self.keys.video].title)
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

		createElements : function(){

			return this
				.createPlayer()
				.createToolbar()
				.createInfobar()
				.createTracklist();
		},

		createPlayer : function(){

			if (this.elements.player.find('object:first').length) return this;

			this.elements.player.width(this.options.width);

			this.elements.playerVideo.height(this.options.height);

			this.options.swfobject.embedSWF(
				'http://www.youtube.com/apiplayer?enablejsapi=1&version=3&playerapiid=youtube&hd=1&showinfo=0', 
				this.elements.playerObject[0].id, '100%', '100%', '8', null, null, this.options.videoParams
			);

			return this;
		},

		createToolbar : function(){

			if (this.elements.toolbar) return this;

			var self = this;

			this.elements.toolbar = $.extend({
				container: 
					$('<ul class="youtube-player-toolbar ui-widget ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all">')
					.css('opacity', 0),
				updateStates : function(){

					$.each(self.elements.toolbar.buttons, function(key){

						this.element.removeClass('ui-state-active');

						(this.element.data('state')) &&
						(this.toggle || 
							(this.toggleButton && 
							self.elements.toolbar.buttons[this.toggleButton])) &&
							this.element.addClass('ui-state-active');
					});
				}
			}, this.options.toolbar || {});

			$.each(this.elements.toolbar.buttons, function(key) {

				if (this.disabled) { 

					delete self.elements.toolbar.buttons[key];

					return true; 
				}

				var buttonObj = this;

				this.element = 
					$('<li class="ui-state-default ui-corner-all">')
					.append('<span class="ui-icon ' + this.icon + '">')
					.attr('title', this.text)
					.data('button', key)
					.bind('mouseenter mouseleave', function(){

						$(this).toggleClass('ui-state-hover'); 
					})
					.click(function(){

						var button = $(this)
							.data('state', $(this).data('state') && buttonObj.toggle ? 0 : 1)
							.data('button');
	
						if (buttonObj.toggleButton) {

							self.elements.toolbar.buttons[buttonObj.toggleButton].element.data('state', 0);
						}

						self.elements.toolbar.updateStates();
	
						if ( self.api[button] ) {

							self.api[button](buttonObj);
						}

					})
					.appendTo(self.elements.toolbar.container);
			});

			this.elements.playerVideo.after(this.elements.toolbar.container);

			return this;
		},

		createInfobar : function(){

			if (this.elements.infobar) return this;

			this.elements.infobar = $('<div>').addClass('youtube-player-infobar ui-widget-content ui-corner-all').css('opacity', 0);

			this.elements.playerVideo.prepend(this.elements.infobar);

			return this;
		},

		createTracklist : function(){

			var self = this;

			if (self.elements.playlist) return this;
			
			function up(){

				self.elements.scrollbar.pos = 
					self.elements.scrollbar.pos > self.elements.playlist.find('li:first').height() ? 
					self.elements.scrollbar.pos - self.elements.playlist.find('li:first').height() : 
					0;

				self.elements.playlistScroller.scrollTop(self.elements.scrollbar.pos);
			}

			function down(){

				self.elements.scrollbar.pos = 
					self.elements.scrollbar.pos < self.elements.playlist.outerHeight() - self.elements.playlistScroller.outerHeight() ? 
					self.elements.scrollbar.pos + self.elements.playlist.find('li:first').height() : 
					self.elements.scrollbar.pos;

				self.elements.playlistScroller.scrollTop(self.elements.scrollbar.pos);
			}

			this.elements.playlistScroller = $('<div class="youtube-player-playlist-scroller">');

			($.fn.mousewheel) &&
				this.elements.playlistScroller.unbind().bind('mousewheel', function(event, delta) {
					delta > 0 ? up() : down();
				});

			this.elements.playlistContainer = $('<div>').addClass('youtube-player-playlist-container ui-widget-content ui-corner-all');

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
						
							up();
						})
						.appendTo(this.elements.playlistContainer),
				down : 
					$('<span>')
						.addClass('youtube-player-playlist-scrollbar-down ui-icon ui-icon-circle-triangle-s')
						.click(function(){ 

							down();
						})
						.appendTo(this.elements.playlistContainer),
				pos : 0
			}

			this.elements.playlist.empty();

			this.videoIds = [];

			$.each(this.options.playlist.videos, function(){

				self.videoIds.push(this.id);

				$('<li>')
					.data('video', this)
					.append(this.title)
					.addClass('ui-state-default')
					.bind('mouseenter mouseleave', function(){

						$(this).toggleClass('ui-state-hover');
					})
					.click(function(){

						self.keys.video = $.inArray( $(this).data('video').id, self.videoIds );

						self.elements.toolbar.buttons.play.element.data('state', 0);
						
						self.updatePlaylist();
						
						self.playVideo();
					})
					.appendTo(self.elements.playlist);
			});

			this.elements.playerVideo.after(
				this.elements.playlistContainer.append(
					this.elements.playlistScroller.append(this.elements.playlist)
				)
			);

			return this;
		}
	};


})(window.jQuery, window, document);
