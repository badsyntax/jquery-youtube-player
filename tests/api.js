/*
 * api.js - part of the jquery youtube player testsuite
 * @author:	Richard Willis
 */

module('api');

var playlist = { title: 'test playlist', videos: [ { id: 'wDowSzVgjXI', title: 'The All Seeing I - Beat Goes On HQ' } ] };

test('API formatting as per documentation', function(){

	var player = $('.player').player({ playlist: playlist }).player('plugin');

	expect(12);

	ok( player.loadPlaylist, 'loadPlaylist()');
	ok( player.loadVideo, 'loadVideo()');
	ok( player.pauseVideo, 'pauseVideo()');
	ok( player.shufflePlaylist, 'shufflePlaylist()');
	ok( player.muteVideo, 'muteVideo()');
	ok( player.repeat, 'repeat()');
	ok( player.playVideo, 'playVideo()');
	ok( player.cueVideo, 'cueVideo()');
	ok( player.randomVideo, 'randomVideo()');
	ok( player.prevVideo, 'prevVideo()');
	ok( player.nextVideo, 'nextVideo()');
	ok( player.destroy, 'destroy()');

	player.destroy();
});

test('loadPlaylist()', function(){

});
