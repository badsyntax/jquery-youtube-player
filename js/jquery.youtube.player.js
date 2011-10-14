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

		// return the value from a method, or the jQuery object
		return val || this;
	}

	// player constuctor
	function player(element, options, pluginName){

		var self = this;

		this._pluginName = pluginName;
		
		this.element = $( element ).addClass('ui-widget');

		this.options = $.extend({
			width: 425,			// player width (integer or string)
			height: 356,			// player height (integer or string)
			swfobject: window.swfobject,	// swfobject object
			playlist: {},			// playlist object (object literal)
			showPlaylist: 1,		// show playlist on plugin init (boolean)
			showTime: 1,			// show current time and duration in toolbar (boolean)
			videoThumbs: 0,			// show videos as thumbnails in the playlist area (boolean) (experimental)
			randomStart: 0,			// show random video on plugin init (boolean)
			autoStart: 0,			// auto play the video after the player as been built (boolean)
			autoPlay: 0,			// auto play the video when loading it via the playlist or toolbar controls (boolean)
			repeat: 1,			// repeat videos (boolean)
			repeatPlaylist: 0,		// repeat the playlist (boolean) 
			shuffle: 0,			// shuffle the play list (boolean)
			chromeless: 1,			// chromeless player (boolean)
			highDef: 0,			// high definition quality or normal quality (boolean)
			playlistHeight: 5,		// height of the playlist (integer) (N * playlist item height)
			playlistBuilder: null,		// custom playlist builder function (null or function) see http://github.com/badsyntax/jquery-youtube-player/wiki/Installation-and-usage#fn9
			playlistBuilderClickHandler: null, // custom playlist video click event handler, useful if you want to prevent default click event (null or function)
			playlistAnimation: { 
				height: 'show', 
				opacity: 'show' 
			},
			playlistSpeed: 550,		// speed of playlist show/hide animate
			toolbarAppendTo: null,		// element to append the toolbar to (selector or null)
			playlistAppendTo: null,		// element to append the playlist to (selector or null)
			timeAppendTo: null,		// elemend to append to time to (selector or null)
			videoParams: {			// video <object> params (object literal)
				allowfullscreen: 'true',
				allowScriptAccess: 'always',
				wmode: 'transparent'
			},
			showToolbar: null,		// show or hide the custom toolbar (null, true or false)
			toolbarButtons: {},		// custom toolbar buttons
			toolbar: 'play,prev,next,shuffle,repeat,mute,playlistToggle', // comma separated list of toolbar buttons
			toolbarAnimation: {
				opacity: 1
			},
			toolbarSpeed: 500
		}, options);

		if (!this.options.chromeless && this.options.showToolbar != true) this.options.showToolbar = 0;

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

		// munge youtube video id from any url
		this._youtubeIdExp = /^[^v]+v.(.{11}).*/;
		
		// extend the default toolbar buttons with user specified buttons (specified buttons will override default)
		this.buttons = $.extend({}, this.defaultToolbarButtons, this.options.toolbarButtons);

		// convert inks to vidoes
		if (this.element.is('a')) {

			var anchor = this.element;

			this.element = $('<div class="youtube-player"></div>');
			var 
				playerVideo = $('<div class="youtube-player-video"></div>').appendTo(this.element),
				playerObject = $('<div class="youtube-player-object"></div>').appendTo(playerVideo),
				playlist = $('<ol class="youtube-player-playlist"><li></li></ol>')
					.find('li')
					.append( anchor.clone() )
					.end()
					.appendTo(this.element);

			anchor.after( this.element ).hide();
		}
		
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
		var id;
		do {
			id = 'jqueryyoutubeplayer' + Math.floor( Math.random() * 101 ).toString();

		} while( document.getElementById(id) );

		this.elements.playerObject[0].id = id;

		(this.options.swfobject.getFlashPlayerVersion().major >= 8) 

			&& this.loadPlaylist(null, null, null, function(){

				// build everything and set event handlers
				self
				._bindYoutubeEventHandlers()
				._createToolbar()
				._createTimeArea()
				._createPlayer();
			});
	}

	// public members
	player.prototype = {
		
		_activeStates: [], timer: {}, videoIds: [],
		
		_trigger : function(scope, callback, arg){

			var type = typeof callback;

			arg = arg || [];

			if ( type === 'string' && this.options[ callback ] && $.isFunction(this.options[ callback ]) ) {

				return this.options[ callback ].apply( scope, arg );

			} else if ( type === 'function' ) {

				callback.apply( scope, arg );
			}
		},
		
		_bindYoutubeEventHandlers : function(){

			var self = this;
			
			function ready(id){

				self.youtubePlayer = document.getElementById(id);
						
				self._trigger(self, 'onPlayerReady', [ id ]);

				self.loadVideo(false, true);

				self.elements.toolbar.container
					.animate(self.options.toolbarAnimation, self.options.toolbarSpeed, function(){

						self._trigger(self, 'onReady', [ id ]);
					});

				self._showPlaylist(function(){

					( self.keys.play ) && self.playVideo();
				});
			}

			function videoPaused(){

				self._trigger(this, 'onVideoPaused', [ self._getVideo() ]);
			}

			function videoEnded(){

				self.buttons.play.element && self.buttons.play.element.trigger( 'off' );

				if (self.options.repeat) {

					self.nextVideo();
				}
			}

			function error(state){

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
			}
			
			function videoCued(){

				self._updatePlaylist();

				self.elements.toolbar.updateStates();
			
				self._trigger(this, 'onVideoCue', arguments);
			}

			function videoBuffer(){

				self._trigger(this, 'onBuffer', [ self._getVideo() ]); 
			}
			
			function videoPlay(){

				self._updatePlaylist();

				self._addState('play');

				self.elements.toolbar.updateStates();

				self._updateTime();

				// update the location hash

				self._trigger(this, 'onVideoPlay', [ self._getVideo() ]);
			}
			
			var id = this.elements.playerObject[0].id;

			window['onytplayerStateChange' + id] = function(state){

				// reset the youtube player states every time an event is executed
				self._removeStates([ -1, 0, 1, 2, 3, 5, 100, 101, 150, 9 ]);

				// add a new youtube state
				self._addState(state, true);

				switch(state) {
					case 0 : videoEnded(); break;
					case 1 : videoPlay(); break;
					case 2 : videoPaused(); break;
					case 3 : videoBuffer(); break;
					case 9 : ready(id); break;
					case 5 : videoCued(); break;
					case 100: case 101: case 150: error( state ); break;
				}

				self._trigger(self, 'onYoutubeStateChange', [ state ]);
			};

			if ( !window.onYouTubePlayerReady ){
			
				window.onYouTubePlayerReady = function(id){ 
			
					var player = document.getElementById(id);

					player.addEventListener("onStateChange", 'onytplayerStateChange' + id);

					player.addEventListener('onError', 'onytplayerStateChange' + id);

					window['onytplayerStateChange' + id](9);
				};
			}

			return this;
		},

		_createPlayer : function(){

			// set the player dimensions
			this.elements.player.width( this.options.width );
			this.elements.playerVideo.height( this.options.height );

			var 
				id = this.options.playlist.videos[this.keys.video].id, 
				apiid = this.elements.playerObject[0].id,
				swfpath = 
					this.options.chromeless 
					? 'http://www.youtube.com/apiplayer?enablejsapi=1&version=3&playerapiid='+apiid+'&hd=' + this.options.highDef + '&showinfo=0'
					: 'http://www.youtube.com/v/' + id + '?enablejsapi=1&playerapiid='+apiid+'&version=3';

			this._trigger(this, 'onBeforePlayerBuild');

			// embed the youtube player
			this.options.swfobject.embedSWF( swfpath, this.elements.playerObject[0].id, '100%', '100%', '8', null, null, this.options.videoParams);

			return this;
		},

		_createToolbar : function(){

			var self = this;

			this.elements.toolbar = {
				container: $('<ul />')
					.addClass('youtube-player-toolbar ui-widget ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all')
					.css('opacity', 0),
				updateStates : function(){

					self.elements.toolbar.container.find('li').each(function(){

						var button = $(this).removeClass('ui-state-active').data('button');

						if (!button) return true;

						(self._state(button.val)) &&
						(button.toggle) && 
						$(this).addClass('ui-state-active');

						(self._state(button.val) && button.toggleButton) && $(this).trigger('on');
					});
				}
			};

			( this.options.showToolbar != null && !this.options.showToolbar ) 
				&& this.elements.toolbar.container.hide();

			$.each(this.options.toolbar.split(','), function(key, val) {

				var button = self.buttons[val];

				if (!button || !button.text) return true;
				
				button.val = val;

				self._states[val] = self._states[val] || val;

				$('<li></li>')
				.addClass('ui-state-default ui-corner-all')
				.append('<span class="ui-icon ' + button.icon + '"></span>')
				.attr('title', button.text)
				.data('button', button)
				.bind('mouseenter mouseleave', function(){

					$(this).toggleClass('ui-state-hover'); 
				})
				.bind('off', function(){

					var elem = $(this), button = elem.data('button'), toggle = 1;
					
					elem.data('toggle', toggle);

					self._removeState(val);

					elem.find('.ui-icon')
						.removeClass( button.toggleButton.icon )
						.addClass( button.icon )
						.end()
						.attr('title', button.text);

					self._trigger(self, button.toggleButton.action, [ button ] );
				})
				.bind('on', function(){

					var elem = $(this), button = elem.data('button'), toggle = 0;
					
					elem.data('toggle', toggle);

					self._addState(val);

					elem
					.find('.ui-icon')
						.removeClass( button.icon )
						.addClass( button.toggleButton.icon )
					.end()
					.attr('title', button.toggleButton.text)

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

			(this.options.toolbarAppendTo) ?
				this.elements.toolbar.container.appendTo( this.options.toolbarAppendTo ) :
				this.elements.playerVideo.after( this.elements.toolbar.container );

			return this;
		},

		_createTimeArea : function(){

			this.elements.toolbar.time = 
				this.options.timeAppendTo 
				? $('<span />').appendTo( this.options.timeAppendTo )
				: $('<li />').addClass('youtube-player-time').appendTo( this.elements.toolbar.container );

			this.elements.toolbar.timeCurrent = $('<span />').html('0:00').appendTo(this.elements.toolbar.time);

			this.elements.toolbar.timeDuration = $('<span />').appendTo(this.elements.toolbar.time);

			return this;
		},

		_createPlaylist : function(){

			var self = this;

			function videoClickHandler(){

				// try get the video object from element data
				var videoData = $( this ).data( 'video' );
				if (!videoData) return;

				// set the video key
				self.keys.video = $.inArray( videoData.id, self.videoIds );

				// reset state
				self._removeState('play');
				
				// update the playlist now that the new video has been selected
				self._updatePlaylist();

				// load the video into the flash player
				self.loadVideo();
				
				// play it
				self.playVideo();
			}

			function buildPlaylist(){

				self.elements.playlist = self.elements.playlist 
					|| $('<ol />').addClass('youtube-player-playlist ui-helper-reset');
				
				self.elements.playlistContainer = self.elements.playlistContainer 
					|| $('<div />')
					.addClass('youtube-player-playlist-container ui-widget-content ui-corner-all')
					.html( self.elements.playlist );
			};

			this._addVideosToPlaylist = function(cue){

				// get this list of vidoes to add to the playlist
				// if cueing, we only want to add 1 video, so we find the last video added to playlist
				var videos = cue 
						? [ self.options.playlist.videos[self.options.playlist.videos.length - 1] ] 
						: self.options.playlist.videos;


				// if we're not cueing the videos then we empty the playlist and reset the video id list
				if (!cue) {
					
					self.elements.playlist.empty();

					self.videoIds = [];
				}

				$.each(videos, function(){

					self.videoIds.push(this.id);

					$('<li />')
						.data('video', this)
						.append( self.options.videoThumbs ? '<img alt="' + this.title + '" title="' + this.title + '" src="http://img.youtube.com/vi/' + this.id + '/2.jpg" />' : this.title)
						.addClass('ui-state-default')
						.addClass( self.options.videoThumbs ? 'youtube-player-thumb' : '' )
						.bind('mouseenter mouseleave', function(){

							$( this ).toggleClass( 'ui-state-hover' );
						})
						.appendTo(self.elements.playlist);
				});

				self._trigger(self, 'onAfterVideosAddedToPlaylist');
			};

			this._bindPlaylistClickHandler = function(playlist){

				playlist
				.items
				.click(function(){

					self._trigger(this, videoClickHandler, arguments);

					self._trigger(self, 'playlistBuilderClickHandler', arguments);
				});
			};

			var playlistBuilder;

			if ( !$.isFunction( this.options.playlistBuilder )){

				buildPlaylist();

				this._addVideosToPlaylist();
				
				(this.options.playlistAppendTo) 
					// append playlist to specified element
					? this.elements.playlistContainer.appendTo( this.options.playlistAppendTo )
					// insert playlist after the toolbar
					: this.elements.toolbar.container.after( this.elements.playlistContainer );
				
				playlistBuilder = function(){
					return {
						items: self.elements.playlist.find('li'),
						container: self.elements.playlistContainer
					}
				};

			} else {

				playlistBuilder = this.options.playlistBuilder;
			}

			// reset the list of video ids
			$.each(this.options.playlist.videos, function(){

				self.videoIds.push( this.id );
			});
		
			// build the playlist
			var playlist = playlistBuilder.call(this, this.options.playlist.videos);
			
			// add the playlist to the DOM
			this.elements.playlistContainer = playlist.container;

			// bind video click handler
			this._bindPlaylistClickHandler(playlist);

			return this;
		},
		
		_updateTime : function(){

			if (!this.options.showTime) return;

			var self = this, duration = Number( this.youtubePlayer.getDuration() );

			function timeFormat(seconds) {

				var m = Math.floor( seconds / 60), s = (seconds % 60).toFixed(0);

				return m + ':' + ( s < 10 ? '0' + s : s);
			}

			this.elements.toolbar.timeDuration.html( ' / ' + timeFormat( duration ));

			this.elements.toolbar.time.fadeIn();

			this.timeInterval = setInterval(function(){

				( !self.youtubePlayer.getCurrentTime )
					? clearInterval( self.timeInterval )
					: self.elements.toolbar.timeCurrent.html( timeFormat( self.youtubePlayer.getCurrentTime() ) );
			}, 100);
		},

		_removeStates : function(states){

			var newArray = [];
			
			$.each(this._activeStates, function(key, value){

				($.inArray(value, states) === -1 
					&& $.inArray(value, newArray) === -1) 
					&& newArray.push(value);
			});

			this._activeStates = newArray;
		},
		
		_removeState : function(state){

			state = typeof state === 'string' ? this._states[ state ] : state;

			this._removeStates([ state  ]);
		},

		_state : function(state, remove){

			state = this._states[ state ];

			return $.inArray(state, this._activeStates) !== -1 ? true : false;
		},

		_addState : function(state, stateID){

			if (stateID) {
			
				$.inArray(state, this._activeStates) === -1 
					&& this._activeStates.push( state );
			
			} else {

				this._states[ state ] 
					&& $.inArray(this._states[ state ], this._activeStates) === -1 
					&& this._activeStates.push( this._states[ state ] );
			}
		},
		
		_setVideoKey : function(val){

			this.keys.video = this.options.shuffle ? this.options.randomVideo() : val || 0;
		},

		_getVideo : function(){

			return this.options.playlist.videos[ this.keys.video ];
		},

		_findVideo : function(id){

			var index = -1;

			$.each(this.options.playlist.videos, function(key, val){

				if (id == val.id) {
				
					index = key;

					return false; // break
				}
			});

			return index;
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
							id: vid.link[0].href.replace(self._youtubeIdExp, '$1'), // munge video id from href
							title: vid.title.$t
						});
					});

					self.elements.playerObject.fadeOut(180, function(){ success.call( self ); });
				}
				
				var url = playlist.user 
					? 'http://gdata.youtube.com/feeds/api/videos'
					: 'http://gdata.youtube.com/feeds/api/playlists/' + playlist.playlist;

				url += '?callback=?';

				var data = { alt: 'json', format: '5' };
				
				if (playlist.user){ data.author = playlist.user; }

				this._trigger(this, 'onBeforePlaylistLoaded', [ playlist ]);

				$.ajax({
					type: 'GET',
					url: url,
					data: data,
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

				return;

			} else if (!playlist.videos){

				var videos = this.elements.player.find('.youtube-player-playlist li a');

				if (videos.length) {
					
					self.options.playlist.videos = [];

					videos.each(function(){
						self.options.playlist.videos.push({
							id: this.href.replace(self._youtubeIdExp, '$1'),
							title: $(this).html(),
							element: this
						});
					});
				}
			}
					
			self._trigger(self, 'onAfterPlaylistLoaded', [ playlist ]);

			self._trigger(self, success);
		},

		_updatePlaylist : function(){

			var self = this;

			(this.elements.playlist) && 
				
				this.elements.playlist
				.find('li')
				.removeClass('ui-state-active')
				.each(function(key){

					if ( self.options.playlist.videos[self.keys.video].id == $(this).data('video').id) {

						var height = $( this ).addClass('ui-state-active').outerHeight();

						if ( !self.options.videoThumbs ){
							
							var pos = (key * height) - ( Math.floor(self.options.playlistHeight / 2) * height);

							self.elements.playlist.scrollTop( pos );
						}

						return false;
					}
				});
		},

		_showPlaylist : function(callback) {

			var show = this.options.showPlaylist;

			( show ) && this.elements.playlistContainer.show();

			var 
				oldHeight = this.elements.playlist.height(),
				scrollerHeight = this.elements.playlist.css('height', 'auto').height(),
				videoHeight = this.elements.playlist.find('li:first').outerHeight(),
				newHeight = videoHeight * this.options.playlistHeight,
				height = newHeight < scrollerHeight ? newHeight : scrollerHeight;
			
			( show ) && this.elements.playlistContainer.hide();

			if ( !this.elements.playlist.children().length ) {

				this.elements.playlistContainer.hide();
					
				this._trigger(this, callback);

			} else if ( height ) {

				this.elements.playlist.height( height );

				if (this.options.showPlaylist || show) {

					this.elements.playlistContainer.animate(this.options.playlistAnimation, this.options.playlistSpeed, callback);

				} else {

					this._trigger(this, callback);
				}
			}
		},

		loadVideo : function(video, cue){

			var self = this;

			function load(videoID){

				( cue ) 
				? self.cueVideo(videoID)
				: self.youtubePlayer.loadVideoById(videoID, 0);

				self._trigger(self, 'onVideoLoad', [ self._getVideo() ]);
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
				//this._showPlaylist(false);

				(!cue) && 
					// load and play the video
					load(video.id);

			} else if (video) {

				// you can't load videos that aren't in the current playlist

				var index = this._findVideo( video );

				if (index !== -1) {

					this.keys.video = index;
					
					load( video );
				}

			} else {

				// try load the next video
				load( this.options.playlist.videos[this.keys.video].id );
			}
		},
		
		loadPlaylist: function(playlist, play, show, success){

			show = show === undefined ? true : show;
			
			if ( playlist ) {

				this.options.playlist = playlist;
			}

			this._getPlaylistData(
				function(){ // success

					this.keys.video = this.options.randomStart ? this.randomVideo() : 0;

					this._trigger(this, success);

					this._createPlaylist();

					(show) && this._showPlaylist();
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

			return this.youtubePlayer.cueVideoById( videoID || this.options.playlist.videos[this.keys.video].id, startTime || 0);
		},

		randomVideo : function(){

			this.keys.video = Math.floor(Math.random() * this.options.playlist.videos.length);

			return this.keys.video;
		},
		
		prevVideo : function(){

			if (this.keys.video > 0) {

				this._setVideoKey( --this.keys.video );

			} else if ( this.options.repeatPlaylist ) {

				this._setVideoKey( this.videoIds.length - 1 );

			} else return;
			
			this.loadVideo(null, this._state('play') || this.options.autoPlay ? false : true);
		},

		nextVideo : function(){

			if (this.keys.video < this.options.playlist.videos.length-1) {
					
				this._setVideoKey( ++this.keys.video );

			} else if ( this.options.repeatPlaylist ) {

				this._trigger(this, 'onEndPlaylist');
				
				this._setVideoKey( 0 );

			} else return;

			this.loadVideo(null, this._state('play') || this.options.autoPlay ? false : true);
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

		// return the plugin object
		plugin : function(){ return this; },

		// return an array of current player states
		state : function(){

			var self = this, states = [];

			$.each(this._activeStates, function(key, val){

				$.each(self._states, function(k, v){

					(val === v) && states.push(k);
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

		destroy: function(){

			clearInterval( this.timeInterval );

			this.element.removeClass('ui-widget').removeAttr('style');

			this.elements.playerVideo.removeAttr('style');

			this.elements.playlistContainer.remove();

			this.elements.toolbar.container.remove();

			this.options.swfobject.removeSWF(this.elements.playerObject[0].id);
			
			this.elements.playerObjectClone.appendTo( this.elements.playerVideo );

			$.removeData( this.element[0], this._pluginName );
		}
	};

	player.prototype.defaultToolbarButtons = {
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
		playlistToggle: { 
			text: 'Toggle playlist', 
			icon: 'ui-icon-script',
			action: function(){

				this.playlistToggle();
			}
		}
	};

})(this.jQuery, this, document);
