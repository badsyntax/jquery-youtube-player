/*
 * destroy.js - part of the jquery youtube player testsuite
 * @author Richard Willis
 */

module('destroy');

var playlist = { title: 'test playlist', videos: [ { id: 'wDowSzVgjXI', title: 'The All Seeing I - Beat Goes On HQ' } ] };

test('destroy', function(){

	stop();

	$('.player').player({ playlist: playlist });

	setTimeout(function(){

		$('.player').player('destroy');

		var hasObject = $('.player').find('object').length

		ok(!hasObject, '<object> tag shouldn\'t exist');

		start();

	}, 1000);
});
