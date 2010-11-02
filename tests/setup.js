module('setup');

test('expected scripts', function(){

	expect(3);

	ok( window.jQuery, 'jQuery should exist' );
	ok( window.swfobject, 'swfobject should exist' );
	ok( window.jQuery.fn.player, 'player plugin should exist' );
});

var playlist = { title: 'test playlist', videos: [ { id: 'wDowSzVgjXI', title: 'The All Seeing I - Beat Goes On HQ' } ] };

test('expected markup', function(){

	expect(3);

	ok( $('.player').length, 'player container' );
	ok( $('.youtube-player-video').length, 'player video container' );
	ok( $('.youtube-player-object').length, 'player object container' );
});

test('expected css', function(){

	ok(true, 'not testing this for now');
});

test('plugin init', function(){

	var v1 = $('.player').player({ playlist: playlist }).player('plugin');
	var v2 = $('.player').player({ playlist: playlist }).player('plugin');

	equals( v1, v2, 'Calling player() multiple times must return the same plugin instance' );

	stop();

	setTimeout(function(){

		var hasObject = $('.player').find('object').length

		ok(hasObject, '<object> tag should exist');

		$('.player').player('destroy');

		start();

	}, 1000);
});
