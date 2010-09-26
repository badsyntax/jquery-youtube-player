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

			// try get the plugin reference from the base element
			var obj = $.data( this, pluginName );

			// the object needs to be initiated before executing public methods
			if ( obj && obj.events && obj.events[method] ) {

				// execute a public method
				obj.events[method].apply( obj, Array.prototype.slice.call( args, 1 ) );
			} 
			// initiate the plugin, attach a reference
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
						toggle: 1
					},
					playlist: { 
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
		this.events = {

			play : function(button, playlistItem){

				self.events.loadVideo();

				self.youtube.playVideo();
			},
			loadVideo : function(videoID){

				self.elements.$infobar.stop().css({opacity: 0});

				self.youtube.loadVideoById(videoID || self.options.playlist.videos[self.keys.video].id, 0);

				self.router.updateHash();
			},
			cueVideo : function(videoID){

				self.youtube.cueVideoById(videoID || self.options.playlist.videos[self.keys.video].id, 0);
			},
			randomVideo : function(){

				self.keys.video = Math.floor(Math.random() * self.options.playlist.videos.length);

				return self.keys.video;
			},
			pause : function(button){

				self.youtube.pauseVideo();
			},
			prev : function(button){

				if (self.keys.video > 0) {

					self.keys.video--;

					self.elements.toolbar.buttons.play.element.data('state', 0);

					self.events.play();
				}
			},
			next : function(button){

				if (self.keys.video < self.options.playlist.videos.length-1) {

					if (self.options.shuffle) {

						self.events.randomVideo();
					} else {

						self.keys.video++;
					}

					self.elements.toolbar.buttons.play.element.data('state', 0);

					self.events.play();
				}
			},
			shuffle : function(button){ 

				self.events.randomVideo();

				self.events.play();
			},
			repeat : function(button){

				self.options.repeat = 1;
			},
			mute : function(button){

				button.element.data('state') ? self.youtube.mute() : self.youtube.unMute();
			},
			playlist : function(button){

				self.elements
					.playlistContainer
					.animate({
						height: 'toggle', 
						opacity: 'toggle'
					}, 550);
			},
			fullscreen: function(button){

				self.youtube.setSize(900, 900);	
			}
		};
			
		this.youtubeEvents = {

			ready : function(){

				self.youtube = self.elements.player.find('object:first').get(0);

				self.youtube.addEventListener('onStateChange', '_youtubeevents');

				self.youtube.addEventListener('onError', '_youtubeevents');

				self.events.cueVideo();

				self.elements.toolbar.$container.fadeIn(400, function(){

					($.isFunction(self.options.onready)) && self.trigger(self.events, 'onready');
				});

				self.elements.playlistContainer.show();

				var videoHeight = self.elements.playlist.find('li:first').outerHeight();
				
				self.elements.playlistContainer.hide();

				self.elements.playlistScroller.height( videoHeight * self.options.playlistHeight );

				if (self.options.showPlaylist) {

					self.elements.playlistContainer.animate({
						height: 'toggle', 
						opacity: 'toggle'
					}, 550);
				}

				if (self.keys.play) {

					self.events.play();
				}
			},
			videoPlay : function(){

				if (!self.elements.toolbar.buttons.play.element.data('state')) {

					self.updatePlaylist();

					self.router.updateHash();

					self.elements.toolbar.buttons.play.element.data('state', 1);

					self.elements.toolbar.updateStates();

					self.elements.$infobar.css({opacity: 0})

					self.updateInfo(320);
				}
			},
			videoEnded : function(){

				if (self.options.repeat) {

					self.events.next();
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
						msg = '';
				}

				self.trigger(this, 'onerror', [msg]);

				alert( 'Sorry, there was an error loading this video. ' + msg );
			},
			videoBuffer : function(){

				self.trigger(this, 'onbuffer', arguments); 
			}
		};

		this.events.scrollbar = {

			up : function(button){

				self.elements.scrollbar.pos = 
					self.elements.scrollbar.pos > self.elements.playlist.find('li:first').height() ? 
					self.elements.scrollbar.pos - self.elements.playlist.find('li:first').height() : 
					0;

				self.elements.playlistScroller.scrollTop(self.elements.scrollbar.pos);
			},
			down : function(button){

				self.elements.scrollbar.pos = 
					self.elements.scrollbar.pos < self.elements.playlist.outerHeight() - self.elements.playlistScroller.outerHeight() ? 
					self.elements.scrollbar.pos + self.elements.playlist.find('li:first').height() : 
					self.elements.scrollbar.pos;

				self.elements.playlistScroller.scrollTop(self.elements.scrollbar.pos);
			}
		};
	
		this.init();
	}

	player.prototype = {
		
		state: -1, timer: {}, router: {}, videoIds: [], elements: {},

		init : function(obj){

			this.element.addClass('ui-widget');

			this.elements.player = this.element;

			this.elements.playerVideo = $('#player-video');

			this.elements.playerObject = $('#player-object');

			this.keys = {
				video: 0
			};

			this.youtube = this.elements.playerObject.get(0);

			this.getPlaylistData(
				function(){ // success

					this.keys.video = this.options.randomStart ? this.events.randomVideo() : 0;

					this
						.createElements()
						.bindPlayerEvents()
						.bindYoutubeEvents()
						.initRouter();
				}, 
				function(){ // error

					this.elements.playerObject
						.html('There was an error loading the playlist.')
						.removeClass('playlist-loading');
				}
			);
		},

		trigger: function(scope, callback, arg){

			var type = typeof callback;

			if ( type === 'string' && this.options[ callback ] ) {

				this.options[ callback ].apply( scope, arg );

			} else if ( type === 'function' ) {

				callback.apply( scope, arg );
			}
		},

		getPlaylistData : function(success, error){

			var self = this, playlist = this.options.playlist;

			if (playlist.user || playlist.playlist) {

				self.elements.playerObject
					.html('loading playlist..')
					.addClass('playlist-loading');

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
					}

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

			this.elements
				.playlist
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
				.bind('mouseenter', function(){ 

					self.updateInfo(); 
				})
				.bind('mouseleave', function(){

					self.hideInfo();
				});

			return this;
		},

		youtubeEventHandler : function(state){

			if (state != this.state) {

				switch(this.state = state) {
					case 0	: 
						this.youtubeEvents.videoEnded(); 
						break;
					case 1 : 
						this.youtubeEvents.videoPlay();
						break;
					case 3 : 
						this.youtubeEvents.videoBuffer(); 
						break;
					case 100: 
					case 101:
					case 150:
						this.youtubeEvents.error( state );
						break;
					case 9 : 
						this.youtubeEvents.ready();
						break;
				}
			}
		},

		updateInfo : function(timeout, text){

			var self = this;

			if (
				( this.elements.toolbar.buttons.play.element.data('state') || this.elements.toolbar.buttons.pause.element.data('state') ) 
				&& this.elements.$infobar.css('opacity') < 1
			) {

				clearTimeout(this.timer.hideInfo);

				this.timer.showInfo = setTimeout(function(){

					self.elements.$infobar
						.stop(true, true)
						.css({ 
							opacity: 0 
						})
						.html(text || self.options.playlist.videos[self.keys.video].title)
						.unbind('click')
						.click(function(){ 

							window.open(self.youtube.getVideoUrl()); 
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

			this.elements.$infobar
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

			this.elements.player.width(this.options.width);

			this.elements.playerVideo.height(this.options.height);

			(this.options.swfobject) && this.options.swfobject.embedSWF(
				'http://www.youtube.com/apiplayer?enablejsapi=1&version=3&playerapiid=youtube&hd=1&showinfo=0', 
				this.youtube.id, '100%', '100%', '8', null, null, this.options.videoParams
			);

			return this;
		},

		createToolbar : function(){
			var self = this;

			this.elements.toolbar = $.extend({
				$container: $('<ul id="player-toolbar" class="ui-widget ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all">'),
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
					.append('<span class="ui-icon '+this.icon+'">')
					.attr('title', this.text)
					.data('button', key)
					.bind('mouseenter', function(){

						$(this).toggleClass('ui-state-hover'); 
					})
					.bind('mouseleave', function(){

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
	
						if ( self.events[button] ) {

							self.events[button](buttonObj);
						}

					})
					.appendTo(self.elements.toolbar.$container);
			});

			this.elements.playerVideo.after(this.elements.toolbar.$container);

			return this;
		},

		createInfobar : function(){

			this.elements.$infobar = $('<div id="player-infobar">').addClass('ui-widget-content ui-corner-all').css('opacity', 0);

			this.elements.playerVideo.prepend(this.elements.$infobar);

			return this;
		},

		createTracklist : function(){

			var self = this;

			this.elements.playlistScroller = this.elements.playlistScroller || $('<div id="player-playlist-scroller">');

			($.fn.mousewheel) &&
				this.elements.playlistScroller.unbind().bind('mousewheel', function(event, delta) {
					delta > 0 ? self.events.scrollbar.up() : self.events.scrollbar.down();
				});

			this.elements.playlistContainer = this.elements.playlistContainer || $('<div id="player-playlist-container">').addClass('ui-widget-content ui-corner-all');

			this.elements.playlist = this.elements.playlist || $('<ol id="player-playlist">').addClass('ui-helper-reset');

			this.elements.scrollbar = this.elements.scrollbar || {
				bar : 
					$('<div id="player-playlist-scrollbar">')
						.addClass('ui-widget ui-widget-content ui-corner-all')
						.appendTo(this.elements.playlistContainer),
				up : 
					$('<span id="player-playlist-scrollbar-up">')
						.addClass('ui-icon ui-icon-circle-triangle-n')
						.click(function(){
						
							self.events.scrollbar.up();
						})
						.appendTo(this.elements.playlistContainer),
				down : 
					$('<span id="player-playlist-scrollbar-down">')
						.addClass('ui-icon ui-icon-circle-triangle-s')
						.click(function(){ 

							self.events.scrollbar.down();
						})
						.appendTo(this.elements.playlistContainer),
				pos : 0
			}

			this.elements.playlist.empty();

			this.videoIds = [];

			$.each(this.options.playlist.videos, function(){

				self.videoIds.push(this.id);

				$('<li></li>')
					.data('video', this)
					.append(this.title)
					.addClass('ui-state-default')
					.mouseenter(function(){

						$(this).addClass('ui-state-hover');
					})
					.mouseleave(function(){

						$(this).removeClass('ui-state-hover');
					})
					.click(function(){

						self.keys.video = $.inArray($(this).data('video').id, self.videoIds);
						self.elements.toolbar.buttons.play.element.data('state', 0);
						self.updatePlaylist();
						self.events.play(null, this);
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
