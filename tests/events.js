/*
 * events.js - part of the jquery youtube player testsuite
 * @author:	Richard Willis
 * @note: 	This test should be the last run, it would be pointless to test these events if parts of the API are broken
 * 		as we need to use the API methods to trigger some of these events.
 */


module('events');

var playlist = { title: 'test playlist', videos: [ { id: 'wDowSzVgjXI', title: 'The All Seeing I - Beat Goes On HQ' } ] };

test('onPlayerReady()', function(){

	stop(1000);

	$('.player').player({
		playlist: playlist,
		onPlayerReady: function(){

			ok(true, 'Flash player has been built and Youtube API is ready to be used.');

			start();

			this.destroy();
		}
	});
});

test('onReady()', function(){

	stop(1000);

	$('.player').player({
		playlist: playlist,
		onReady: function(){

			ok(true, 'Player and toolbar have been constructed and animated, first video has been cued.');

			start();

			this.destroy();
		}
	});
});

test('onYoutubeStateChange()', function(){});
test('onVideoLoad()', function(){});
test('onVideoCue()', function(){});
test('onVideoPlay()', function(){})
test('onVideoPaused()', function(){});
test('onBuffer()', function(){});
test('onError()', function(){});
test('onBeforePlaylistLoaded()', function(){});
test('onAfterPlaylistLoaded()', function(){});
