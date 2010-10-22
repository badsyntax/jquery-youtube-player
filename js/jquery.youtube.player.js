/*
 * jquery.youtube.js v0.1a1 - a jquery youtube player
 * Copyright (c) 2010 Richard Willis
 * MIT license	: http://www.opensource.org/licenses/mit-license.php
 * Project	: http://github.com/badsyntax/jquery-youtube-player
 * Contact	: willis.rh@gmail.com | badsyntax.co.uk
 */

(function($, window, document, undefined){

	$.fn.player = function(method){

		var pluginName = 'jquery-youtube-player', args = arguments, val = undefined;

		this.each(function(){

			// get plugin reference
			var obj = $.data( this, pluginName );

			if ( obj && obj[method]) {

				// execute a public method, store the return value
				val = obj[method].apply( obj, Array.prototype.slice.call( args, 1 ) );

				// only the 'plugin' public method is allowed to return a value
				val = (method == 'plugin') ? val : undefined;
			} 
			else if ( !obj && ( typeof method === 'object' || ! method ) ) {

				// initiate the plugin
				$.data( this, pluginName, new player(this, method, pluginName) );
			}
		});

		// return the value from an API method or the jQuery object
		return val || this;
	}

	// player constuctor
	function player(element, options, pluginName){

		var self = this;

		this._pluginName = pluginName;
		
		this.element = $( element ).addClass('ui-widget');

		this.options = $.extend({
			width: 425,			// player width (integer)
			height: 356,			// player height (integer)
			swfobject: window.swfobject,	// swfobject object (object)
			playlist: {},			// playlist object (object literal)
			showPlaylist: 1,		// show playlist on plugin init (boolean)
			showTime: 1,			// show current time and duration in toolbar (boolean)
			showTitleOverlay: 1,		// show video title overlay text (boolean)
			videoThumbs: 0,			// show videos as thumbnails in the playlist area (boolean) (experimental)
			randomStart: 0,			// show random video on plugin init (boolean)
			autoStart: 0,			// auto start the video on init (boolean)
			repeat: 0,			// repeat videos (boolean)
			shuffle: 0,			// shuffle the play list (boolean)
			updateHash: 0,			// update the location hash on video play (boolean)
			highDef: 0,			// high definition quality or normal quality (boolean)
			playlistHeight: 5,		// height of the playlist (integer) (N * playlist item height)
			playlistBuilder: null,		// custom playlist builder function (null or function) see http://github.com/badsyntax/jquery-youtube-player/wiki/Installation-and-usage#fn9
			playlistBuilderClickHandler: null, // custom playlist video click event handler, useful if you want to prevent default click event (null or function)
			playlistSpeed: 550,		// speed of playlist show/hide animate
			toolbarAppendTo: null,		// element to append the toolbar to (selector or null)
			playlistAppendTo: null,		// element to append the playlist to (selector or null)
			timeAppendTo: null,		// elemend to append to time to (selector or null)
			videoParams: {			// video <object> params (object literal)
				allowfullscreen: 'true',
				allowScriptAccess: 'always',
				wmode:	'transparent'
			},
			toolbarButtons: {},		// custom toolbar buttons
			toolbar: 'play,prev,next,shuffle,repeat,mute,playlistToggle' // comma separated list of toolbar buttons
		}, options);

		// these initial states are the youtube player states
		// button states will be added to this object
		this._states = {
			'unstarted': -1,
			'ended': 0,
			'play': 1,
			'paused': 2,
			'buffering': 3,
			'cued': 5
		};
		
		// extend the default toolbar buttons with user specified buttons (specified buttons will override default)
		this.buttons = $.extend({}, $.youtubePlayerButtons, this.options.toolbarButtons);

		// store common elements
		this.elements = {
			player: this.element,
			playerVideo: this.element.find('.youtube-player-video'),
			playerObject: this.element.find('.youtube-player-object')
		};

		// swfobject will destroy the video object <div>, so we clone it to use it to restore it when destroy()ing the plugin
		this.elements.playerObjectClone = this.elements.playerObject.clone();

		this.keys = { video: 0 };

		// swfobject requires the video object <div> to have an id set
		this._uniqueId( this.elements.playerObject[0], 'youtube-player-' );

		// load and check the playlist before building the player
		this.loadPlaylist(null, null, null, function(){

			// build everything and set event handlers
			self
			._createElements()
			._bindPlayerEventHandlers()
			._bindYoutubeEventHandlers()
			._initRouter();
		});
	}

	// public members
	player.prototype = {
		
		_activeStates: [], timer: {}, router: {}, videoIds: [],
		
		_initRouter :  function(){

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

		_uniqueId : function(node, prefix){

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

		_trigger : function(scope, callback, arg){

			var type = typeof callback;

			arg = arg || [];

			if ( type === 'string' && this.options[ callback ] && $.isFunction(this.options[ callback ]) ) {

				return this.options[ callback ].apply( scope, arg );

			} else if ( type === 'function' ) {

				callback.apply( scope, arg );
			}
		},
		
		// button data setter/getter
		_buttonData : function(name, key, value){

			if ( this.buttons[ name ] && this.buttons[ name ].element) {

				return !value ? this.buttons[ name ].element.data( key ) : this.buttons[ name ].element.data( key, value );
			}
		},
		
		_bindYoutubeEventHandlers : function(){

			var self = this;
				
			this.youtubePlayerEvents = {

				ready : function(){

					self.youtubePlayer = self.elements.playerVideo.find('object:first').get(0);

					try {

						self.youtubePlayer.addEventListener('onStateChange', '_youtubeevents');

						self.youtubePlayer.addEventListener('onError', '_youtubeevents');

					} catch(e) {

						self._triger(self, 'onError', [ e ] );
					}

					var startTime = self._buttonData('fullscreen', 'time') || 0;

					self.loadVideo(false, true);

					if (startTime && self._state('play')) self.playVideo(false, startTime);

					self.elements.toolbar.container
						.animate({opacity: 1}, 400, function(){

							self._trigger(self, 'onReady', arguments);
						});

					self._showPlaylist();
			
					if (self.keys.play) {

						self.playVideo();
					}
				},
				videoPlay : function(){

					self._updatePlaylist();

					self.router.updateHash();

					self._addState('play');

					self.elements.toolbar.updateStates();

					self._updateInfo(320);

					self._updateTime();

					self._trigger(this, 'onVideoPlay', arguments);
				},
				videoPaused : function(){

					self._trigger(this, 'onVideoPaused', arguments);
				},
				videoEnded : function(){

					self.buttons.play.element.trigger( 'off' );

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

					if (self._trigger(this, 'onError', [msg]) === undefined){

						alert( 'There was an error loading this video. ' + msg );
					}
				},
				videoBuffer : function(){

					self._trigger(this, 'onBuffer', arguments); 
				}
			};

			window.onYouTubePlayerReady = function(){ 

				self._youtubeEventHandler(9); 
			};

			window._youtubeevents = function(state){ 

				self._youtubeEventHandler(state); 
			};

			return this;
		},

		_bindPlayerEventHandlers : function(){

			var self = this;

			this.elements.playerVideo
				.one('mouseenter.player', function(){ 

					self._updateInfo(); 
				})
				.one('mouseleave.player', function(){

					self._hideInfo();
				});

			return this;
		},

		_youtubeEventHandler : function(state){

			// reset the youtube player states every time an event is executed
			this._removeStates([ -1, 0, 1, 2, 3, 5, 100, 101, 150, 9 ]);

			// add a new youtube state
			this._addState(state, true);

			// execute handler based on state
			switch(state) {
				case 0	: 
					this.youtubePlayerEvents.videoEnded(); 
					break;
				case 1 : 
					this.youtubePlayerEvents.videoPlay();
					break;
				case 2 :
					this.youtubePlayerEvents.videoPaused();
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

			this._trigger(this, 'onYoutubeStateChange', [ state ]);
		},

		_removeStates : function(states){

			var newArray = [];
			
			$.each(this._activeStates, function(key, value){

				($.inArray(value, states) === -1 && $.inArray(value, newArray) === -1) && newArray.push(value);
			});

			this._activeStates = newArray;
		},
		
		_removeState : function(state){

			this._removeStates([ this._states[ state ]  ]);

			
		},

		_state : function(state, remove){

			state = this._states[ state ];

			return $.inArray(state, this._activeStates) !== -1 ? true : false;
		},

		_addState : function(state, stateID){

			if (stateID) {
			
				$.inArray(state, this._activeStates) === -1 &&
				this._activeStates.push( state );
			
			} else {

				this._states[ state ] && 
				$.inArray(this._states[ state ], this._activeStates) === -1 &&
				this._activeStates.push( this._states[ state ] );
			}
		},

		
		_getPlaylistData : function(success, error){

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

				url += '?callback=?';

				this._trigger(this, 'onBeforePlaylistLoaded', [ playlist ]);

				$.ajax({
					type: 'GET',
					url: url,
					data: { alt: 'json' },
					dataType: 'json',
					error: function(){ 
				
						self._trigger(self, 'onAfterPlaylistLoaded', [ playlist ]);

						self._trigger(self, error);
					},
					success: function(){
						
						self._trigger(self, 'onAfterPlaylistLoaded', [ playlist ]);

						self._trigger(self, ajaxSuccess, arguments);
					}
				});

			} else {
						
				self._trigger(self, 'onAfterPlaylistLoaded', [ playlist ]);

				self._trigger(self, success);
			}
		},

		_updatePlaylist : function(){

			var self = this;

			(this.elements.playlist) && this.elements.playlist
				.find('li')
				.removeClass('ui-state-active')
				.each(function(key){

					if (self.options.playlist.videos[self.keys.video].id == $(this).data('video').id) {

						var height = $(this).addClass('ui-state-active').outerHeight();

						if ( !self.options.videoThumbs ){
							
							var pos = (key * height) - ( Math.floor(self.options.playlistHeight / 2) * height);

							self.elements.playlist.scrollTop( pos );
						}

						return false;
					}
				});
		},

		_showPlaylist : function(show) {

			show = show === undefined ? true : show;

			(show) && this.elements.playlistContainer.show();

			var 
				oldHeight = this.elements.playlist.height(),
				scrollerHeight = this.elements.playlist.css('height', 'auto').height(),
				videoHeight = this.elements.playlist.find('li:first').outerHeight(),
				newHeight = videoHeight * this.options.playlistHeight,
				height = newHeight < scrollerHeight ? newHeight : scrollerHeight;
			
			(show) && this.elements.playlistContainer.hide();

			if (!this.elements.playlist.children().length) {
				this.elements.playlistContainer.hide();

			} else if (height) {

				this.elements.playlist.height( height );

				if (this.options.showPlaylist || show) {

					this.elements.playlistContainer.animate({
						height: 'show', 
						opacity: 'show'
					}, this.options.playlistSpeed);
				}
			}
		},

		// option setter/getter
		option : function(option, value){

			if (!value) {

				return this.options[ option ];

			} else {

				this.options[ option ] = value;
			}
		},
				
		loadVideo : function(video, cue){

			var self = this;

			this._hideInfo();

			function load(videoID){

				( cue ) 
				? self.cueVideo(videoID) 
				: self.youtubePlayer.loadVideoById(videoID, 0);

				// update the location hash
				self.router.updateHash();

				// TODO: need to determine if video has loaded successfully 
				self._trigger(self, 'onVideoLoad', [ videoID ]);
			}

			if (video && video.id) {
			
				video = {
					id: video.id,
					title: video.title
				};

				this.videoIds = cue ? this.videoIds : [];

				if (cue) {

					// append video to video list
					this.options.playlist.videos.push(video);

				} else {

					// add video to video list only if a title is present
					this.options.playlist.videos = video.title ?  [ video ] : [];
				}

				// add video/s to playlist
				this._addVideosToPlaylist(cue);

				// update the height of the playlist, but don't explicidly show it
				this._showPlaylist(false);

				(!cue) && 
					// load and play the video
					load(video.id);
			} else {

				// try load the next video
				load( this.options.playlist.videos[this.keys.video].id );
			}
		},
		
		loadPlaylist: function(playlist, play, show, success){
			
			if ( playlist ) {

				this.options.playlist = playlist;

			}

			this._getPlaylistData(
				function(){ // success

					this.keys.video = this.options.randomStart ? this.randomVideo() : 0;

					// has the flash object been built?
					if (this.youtubePlayer) {

						// reset the playlist
						this._addVideosToPlaylist();

						// play or cue the video
						(play) ? this.loadVideo() : this.cueVideo();

						this._showPlaylist(show);

					}

					this._trigger(this, success);
				}, 
				function(){ // error

					var msg = 'There was an error loading the playlist.';

					this.elements.playerObject.html( msg );

					this._trigger(this, 'onError', [msg]);
				}
			);
		},
			
		pauseVideo : function(){

			this.youtubePlayer.pauseVideo();
		},

		shufflePlaylist : function(){
	
			this.randomVideo();

			this.playVideo();
		},
		
		muteVideo : function(button){

			this._state('mute') ? this.youtubePlayer.unMute() : this.youtubePlayer.mute();
		},
	
		// FIXME
		repeat : function(){

			this.options.repeat = 1;
		},
				
		playVideo : function(){
		
			this.youtubePlayer.playVideo();
		},

		cueVideo : function(videoID, startTime){

			videoID = videoID || this.options.playlist.videos[this.keys.video].id;

			this._trigger(this, 'onVideoCue', [ videoID ]);

			return this.youtubePlayer.cueVideoById( videoID, startTime || 0);
		},

		randomVideo : function(){

			this.keys.video = Math.floor(Math.random() * this.options.playlist.videos.length);

			return this.keys.video;
		},

		prevVideo : function(){

			if (this.keys.video > 0) {

				this.keys.video--;

				this.loadVideo();

				this.playVideo();
			} else {

				// trigger callback
			}
		},

		nextVideo : function(){

			if (this.keys.video < this.options.playlist.videos.length-1) {

				if (this.options.shuffle) {

					this.randomVideo();
				} else {

					this.keys.video++;
				}

				this.loadVideo();

				this.playVideo();
			} else {

				// trigger callback
			}
		},
		
		playlistToggle : function(button){

			(this.elements.playlistContainer.find('li').length) &&
				this.elements
					.playlistContainer
					.animate({
						height: 'toggle', 
						opacity: 'toggle'
					}, this.options.playlistSpeed);
		},

		fullscreen: function(button){

			var self = this;

			this._hideInfo();

			button.element
				.one('open.player', function(){
			
					$.data(this, 'height', self.elements.playerVideo.height());
					$.data(this, 'time', self.youtubePlayer.getCurrentTime());

					$('body').css('overflow', 'hidden');
		
					self.elements.playerVideo
						.css({
							height: '100%',
							width: '100%',
							position: 'absolute',
							top: 0,
							left: 0,
							zIndex: 9999
						})
						.appendTo( document.body );
				})
				.one('close.player', function(){
					
					$.data(this, 'time', self.youtubePlayer.getCurrentTime());
					
					$('body').css('overflow', 'auto');

					self.elements.playerVideo
						.height( $.data(this, 'height') )
						.css('position', 'static')
						.prependTo( self.elements.player );
					
					self._removeState('fullsreen');
				})
				.trigger('open.player');

			// bind close player handlers

			self.elements.playerVideo.one('dblclick', function(){

				button.element.trigger('close.player');
			});

			$(document).one('keypress', function(event){

				if (event.keyCode == 27) {

					button.element.trigger('close.player');
				}
			});
		},

		// return the plugin object
		plugin : function(){

			return this;
		},

		// return an array of current player states
		state : function(){

			var self = this, states = [];

			$.each(this._activeStates, function(key, val){

				$.each(self._states, function(k, v){

					if (val === v) states.push(k);
				});
			});

			return states;
		},

		videos : function(){

			return this.options.playlist.videos;
		},

		videoIndex : function(){

			return this.keys.video;
		},

		_updateInfo : function(timeout, text){

			if (!this.options.showTitleOverlay || this._state('fullscreen')) return;
				
			text = text || ( 
					this.options.playlist.videos[this.keys.video] ? 
					this.options.playlist.videos[this.keys.video].title : ''
				);

			var self = this;

			if ( ( this._state('play') || this._state('pause') ) && this.elements.infobar.css('opacity') < 1 && text) {

				clearTimeout(this.timer._hideInfo);

				this.timer.showInfo = setTimeout(function(){

					self.elements.infobar
						.stop(true, true)
						.css({ 
							opacity: 0 
						})
						.html( text )
						.unbind('click')
						.click(function(){ 
							
							// pause the video
							self.buttons.play.element.trigger( 'off' );

							window.open( self.youtubePlayer.getVideoUrl() ); 
						})
						.animate({ opacity: 1 }, 180, function(){

							self.timer._hideInfo = setTimeout(function(){
								self._hideInfo();
							}, 6000);
						});

				}, timeout || 0);
			}
		},

		_hideInfo : function(){

			clearTimeout(this.timer._hideInfo);

			clearTimeout(this.timer.showInfo);

			this.elements.infobar
				.stop(true, true)
				.animate({
					opacity: 0
				}, 120);
		},

		_updateTime : function(){

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

		_createElements : function(){
			
			var flashVersion = this.options.swfobject.getFlashPlayerVersion();

			if (flashVersion.major >= 8){

				this
				._createPlayer()
				._createToolbar()
				._createInfobar();

				this._createPlaylist();
			}

			return this;
		},

		_createPlayer : function(){

			this.elements.player.width( parseInt( this.options.width ) );

			this.elements.playerVideo.height( parseInt( this.options.height ) );

			var swfpath = 'http://www.youtube.com/apiplayer?enablejsapi=1&version=3&playerapiid=youtube&hd=' + this.options.highDef + '&showinfo=0';

			this.options.swfobject.embedSWF( swfpath, this.elements.playerObject[0].id, '100%', '100%', '8', null, null, this.options.videoParams);

			return this;
		},
		_createToolbar : function(){

			var self = this;

			this.elements.toolbar = {
				container: 
					$('<ul class="youtube-player-toolbar ui-widget ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all">')
					.css('opacity', 0),
				updateStates : function(){

					$.each(self.options.toolbar.split(','), function(key, val) {

						var button = self.buttons[val];

						if (!button) return true;

						button.element.removeClass('ui-state-active');

						(self._state(val)) &&
						(button.toggle) && 
						button.element.addClass('ui-state-active');

						if (self._state(val) && button.toggleButton){

							button.element.trigger('on');
						}
					});
				}
			};

			function checkStateExists(state){

				var found = false;

				$.each(self._states, function(key){

					if (state == key) {

						found = true;

						return false;
					}
				});

				if (!found) {

					self._states[state] = state;
				}

				return found;
			}

			$.each(this.options.toolbar.split(','), function(key, val) {

				var button = self.buttons[val];

				if (!button || !button.text) return true;

				checkStateExists(val);

				self.buttons[val].element =
					$('<li class="ui-state-default ui-corner-all"></span>')
					.append('<span class="ui-icon ' + button.icon + '"></span>')
					.attr('title', button.text)
					.data('button', button)
					.bind('mouseenter mouseleave', function(){

						$(this).toggleClass('ui-state-hover'); 
					})
					.bind('off', function(){

						var button = $(this).data('button'), toggle = 1;
						
						$(this).data('toggle', toggle);

						self._removeState(val);

						button.element.find('.ui-icon')
							.removeClass( button.toggleButton.icon )
							.addClass( button.icon );
		
						button.element.attr('title', button.text);

						self._trigger(self, button.toggleButton.action, [ button ] );
					})
					.bind('on', function(){

						var button = $(this).data('button'), toggle = 0;
						
						$(this).data('toggle', toggle);

						self._addState(val);

						button.element.find('.ui-icon')
							.removeClass( button.icon )
							.addClass( button.toggleButton.icon );

						button.element.attr('title', button.toggleButton.text)

						self._trigger(self, button.action, [ button ] );
					})
					.bind('toggle', function(){
						
						var toggle = $(this).data('toggle');

						( toggle || toggle == undefined) ? $(this).trigger('on') : $(this).trigger('off');
					})
					.click(function(){

						var button = $(this).data('button'), 
							state = self._state(val);

						if (button.toggleButton) {
							
							$(this).trigger('toggle');

						} else {

							self._trigger(self, button.action, [ button ] );

							( !button.toggle || ( button.toggle && state ) ) 
							? self._removeState(val) 
							: self._addState(val);

							self.elements.toolbar.updateStates();
						}
					})
					.appendTo(self.elements.toolbar.container);
			});

			this._createTimeArea();

			(this.options.toolbarAppendTo) ?
				this.elements.toolbar.container.appendTo( this.options.toolbarAppendTo ) :
				this.elements.playerVideo.after( this.elements.toolbar.container );

			return this;
		},

		_createTimeArea : function(){

			this.elements.toolbar.time = 
				this.options.timeAppendTo 
				? $('<span />').appendTo(this.options.timeAppendTo)
				: $('<li class="youtube-player-time">').appendTo(this.elements.toolbar.container);

			this.elements.toolbar.timeCurrent = $('<span>').html('0:00').appendTo(this.elements.toolbar.time);

			this.elements.toolbar.timeDuration = $('<span>').appendTo(this.elements.toolbar.time);
		},

		_createInfobar : function(){

			this.elements.infobar = $('<div>')
				.addClass('youtube-player-infobar ui-widget-content')
				.css('opacity', 0)
				.bind('mouseenter mouseleave', function(){

					$(this).toggleClass('ui-state-hover');
				});

			this.elements.playerVideo.prepend(this.elements.infobar);

			return this;
		},

		_createPlaylist : function(){

			var self = this;

			function videoClickHandler(){

				var videoData = $(this).data('video');


				if (!videoData) return;

				self.keys.video = $.inArray( videoData.id, self.videoIds );

				self._removeState('play');
				
				self._updatePlaylist();

				self.loadVideo();
				
				self.playVideo();
			}

			this._buildPlaylist = function(){

				self.elements.playlistContainer = $('<div>').addClass('youtube-player-playlist-container ui-widget-content ui-corner-all');
				
				self.elements.playlist = $('<ol>').addClass('youtube-player-playlist ui-helper-reset');
			};

			this._addVideosToPlaylist = function(cue){

				// get this list of vidoes to add to the playlist
				// if cueing, we only want to add 1 video, so we find the last video added to playlist
				var videos = cue ? [ self.options.playlist.videos[self.options.playlist.videos.length - 1] ] : self.options.playlist.videos;

				if (!cue) {

					self.elements.playlist.empty();
				}

				self.videoIds = [];

				$.each(videos, function(){

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
			
							self._trigger(this, videoClickHandler, arguments);
						})
						.appendTo(self.elements.playlist);
				});
			};

			if (this.options.playlistBuilder && $.isFunction( this.options.playlistBuilder )) {

				$.each(this.options.playlist.videos, function(){

					self.videoIds.push( this.id );
				});

				var playlist = this.options.playlistBuilder.call(this, this.options.playlist.videos);

				playlist
					.items
					.click(function(){

						self._trigger(this, videoClickHandler, arguments);

						self._trigger(self, 'playlistBuilderClickHandler', arguments);
					});

				this.elements.playlistContainer = playlist.container;

			} else {

				this._buildPlaylist();

				this._addVideosToPlaylist();

				this.elements.playlistContainer.append( this.elements.playlist );

				if (this.options.playlistAppendTo) {

					// append playlist to specified element
					this.elements.playlistContainer.appendTo( this.options.playlistAppendTo );

				} else {

					// insert playlist after the toolbar
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
		
	$.youtubePlayerButtons = {

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
			action: function(button){

				this.fullscreen(button);
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

})(this.jQuery, this, document);
